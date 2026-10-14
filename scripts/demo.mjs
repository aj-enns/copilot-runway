import { readFile, writeFile, mkdir, readdir, lstat, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { root, assertNoSymlink } from "./lib.mjs";
import { fixtures, supportExpected, applications } from "../demos/fixtures.mjs";
import { rehearseWorkflow } from "../demos/dynamic-workflows/offline.mjs";
import { validateAssessment } from "../demos/dynamic-workflows/workflow.mjs";

const markerName = ".runway-demo.json";

export function workspaceFor(id, repositoryRoot = root) {
  if (!Object.hasOwn(fixtures, id)) throw new Error(`Unknown demo '${id}'. Choose ${Object.keys(fixtures).join(", ")}`);
  return resolve(repositoryRoot, ".demo-workspaces", id);
}

async function inspectWorkspace(id, repositoryRoot, requireMarker) {
  const directory = workspaceFor(id, repositoryRoot);
  await assertNoSymlink(directory, repositoryRoot);
  try {
    const entries = await readdir(directory);
    const allowed = new Set([markerName, ...Object.keys(fixtures[id].files), ...fixtures[id].outputs]);
    if (entries.some((entry) => !allowed.has(entry))) {
      throw new Error(`Refusing to overwrite ${directory}: unexpected files must be reviewed and moved by the owner`);
    }
    for (const entry of entries) {
      const stat = await lstat(join(directory, entry));
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing non-regular demo file: ${entry}`);
    }
    const marker = JSON.parse(await readFile(join(directory, markerName), "utf8"));
    if (marker.owner !== "copilot-runway" || marker.schemaVersion !== 1 || marker.demo !== id) {
      throw new Error("Demo workspace marker does not match the requested demo");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (requireMarker) throw new Error(`Demo not initialized or marker missing: run npm run demo:setup -- ${id}`);
    const entries = await readdir(directory).catch((readError) => {
      if (readError.code !== "ENOENT") throw readError;
      return [];
    });
    if (entries.length) throw new Error(`Refusing an unmarked nonempty workspace: ${directory}`);
  }
  return directory;
}

export async function setupDemo(id, repositoryRoot = root, reset = false) {
  const directory = await inspectWorkspace(id, repositoryRoot, reset);
  await mkdir(directory, { recursive: true });
  for (const output of fixtures[id].outputs) {
    try {
      await unlink(join(directory, output));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const [name, content] of Object.entries(fixtures[id].files)) {
    await writeFile(join(directory, name), content);
  }
  await writeFile(join(directory, markerName), `${JSON.stringify({ schemaVersion: 1, owner: "copilot-runway", demo: id }, null, 2)}\n`);
  return directory;
}

async function readOutput(directory, name) {
  try {
    return JSON.parse(await readFile(join(directory, name), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Expected live-demo result ${name} is absent. An offline rehearsal does not create it.`);
    throw error;
  }
}

export async function verifyDemo(id, repositoryRoot = root) {
  const directory = await inspectWorkspace(id, repositoryRoot, true);
  if (id === "computer-use") {
    const saved = (await readFile(join(directory, "support-brief.txt"), "utf8")).replace(/\r\n/g, "\n");
    if (saved !== supportExpected) {
      throw new Error("Support brief does not contain exactly the two requested edits");
    }
  } else if (id === "autopilot") {
    const originalTest = fixtures.autopilot.files["discount.test.mjs"];
    if (await readFile(join(directory, "discount.test.mjs"), "utf8") !== originalTest) {
      throw new Error("The demo test file was modified; repair the implementation, not the acceptance criteria");
    }
    const environment = { ...process.env };
    // A nested runner must not inherit node:test's worker mode.
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ["--test", join(directory, "discount.test.mjs")], {
      cwd: directory, encoding: "utf8", timeout: 20_000, env: environment,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Discount acceptance tests failed:\n${result.stdout}${result.stderr}`);
  } else if (id === "dynamic-workflows") {
    const report = await readOutput(directory, "assessment.json");
    if (report.schemaVersion !== 1 || report.status !== "completed" ||
      report.classification !== "synthetic" || typeof report.runId !== "string" ||
      report.runId === "offline-rehearsal-not-a-live-run" || !report.runId.trim() ||
      !Array.isArray(report.assessments) || report.assessments.length !== applications.length) {
      throw new Error("Expected a completed, synthetic, non-rehearsal workflow report with exactly two assessments");
    }
    for (const app of applications) {
      const result = report.assessments.find((item) => item.id === app.id);
      if (!result) throw new Error(`Missing assessment for ${app.id}`);
      const { decision, ...agentAssessment } = result;
      const validated = validateAssessment(agentAssessment, app);
      if (decision !== validated.decision) throw new Error(`Wrong gate decision for ${app.id}`);
    }
  } else if (id === "cloud-sandboxes") {
    const proof = await readOutput(directory, "sandbox-proof.json");
    if (proof.platform !== "linux" || proof.sum !== 10 || proof.execution !== "remote") {
      throw new Error("Expected Linux, sum 10, and execution remote; independently inspect the actual cloud session");
    }
  } else if (id === "copilot-memory") {
    const ticket = await readOutput(directory, "ticket.json");
    if (ticket.id !== "demo-ticket") throw new Error("Expected a lowercase, hyphenated demo-ticket ID");
  } else if (id === "agentic-workflows") {
    const evidence = await readOutput(directory, "candidate-review.json");
    if (evidence.classification !== "candidate" || evidence.adopted !== false ||
      !/^https:\/\/github\.com\/hammadorg93\/copilot-runway\/actions\/runs\/\d+$/.test(evidence.workflowRunUrl) ||
      !/^https:\/\/github\.com\/hammadorg93\/copilot-runway\/pull\/\d+$/.test(evidence.draftPullRequestUrl)) {
      throw new Error("Expected candidate-only evidence with exact-repository run and draft-PR links");
    }
  }
  return { directory, scope: "Local output contract only. Inspect live tool traces, policy enforcement, remote state, and identity separately." };
}

export async function rehearseDemo(id, repositoryRoot = root) {
  const directory = await inspectWorkspace(id, repositoryRoot, true);
  let result;
  let output;
  if (id === "dynamic-workflows") {
    result = await rehearseWorkflow();
    output = "offline-assessment.json";
  } else if (id === "agentic-workflows") {
    result = { mode: "offline-rehearsal", classification: "candidate", adopted: false, lifecycle: "unverified", reviewRequired: true };
    output = "offline-review.json";
  } else if (id === "cloud-sandboxes") {
    result = { mode: "offline-rehearsal", platform: process.platform, sum: 10, execution: "local", remoteSessionCreated: false };
    output = "offline-proof.json";
  } else if (id === "copilot-memory") {
    result = { mode: "offline-rehearsal", id: "demo-ticket", memoryStored: false };
    output = "offline-ticket.json";
  } else {
    return { mode: "offline-rehearsal", note: "No edits made. Follow the native/CLI runbook to perform the real demo.", directory };
  }
  await writeFile(join(directory, output), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, id, ...extras] = process.argv.slice(2);
    if (extras.length || !["setup", "reset", "verify", "rehearse"].includes(command)) {
      throw new Error("Usage: node scripts/demo.mjs <setup|reset|verify|rehearse> <feature-id>");
    }
    if (command === "setup" || command === "reset") {
      const directory = await setupDemo(id, root, command === "reset");
      console.log(`${command === "reset" ? "Reset" : "Prepared"} synthetic workspace: ${directory}\nOnly manifest-listed local files were touched. No Copilot settings, memory, app approvals, credentials, or cloud resources were changed.`);
    } else if (command === "verify") {
      const result = await verifyDemo(id);
      console.log(`Expected local output verified: ${result.directory}\n${result.scope}`);
    } else {
      console.log(JSON.stringify(await rehearseDemo(id), null, 2));
      console.log("Offline rehearsal only: no Copilot run, memory store, remote service, or paid model call.");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
