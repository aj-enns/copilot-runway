import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, unlink, readdir, rmdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { fromRoot } from "../scripts/lib.mjs";
import { setupDemo, verifyDemo, rehearseDemo, workspaceFor } from "../scripts/demo.mjs";
import { fixtures, supportBaseline, supportExpected, applications } from "../demos/fixtures.mjs";
import { workflowDefinition, validateApplications, validateAssessment } from "../demos/dynamic-workflows/workflow.mjs";
import { rehearsalContext, rehearseWorkflow, ReviewCheckpoint } from "../demos/dynamic-workflows/offline.mjs";

async function removeOwnedTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) await removeOwnedTree(path);
    else await unlink(path);
  }
  await rmdir(directory);
}

async function isolated(context) {
  await mkdir(fromRoot("qa-results"), { recursive: true });
  const root = await mkdtemp(fromRoot("qa-results", "unit-demo-"));
  context.after(() => removeOwnedTree(root));
  return root;
}

test("all demo fixtures reset twice without touching an unrelated file", async (context) => {
  const root = await isolated(context);
  await writeFile(join(root, "unrelated.txt"), "must survive");
  for (const id of Object.keys(fixtures)) {
    const directory = await setupDemo(id, root);
    for (const [name, content] of Object.entries(fixtures[id].files)) {
      assert.equal(await readFile(join(directory, name), "utf8"), content);
    }
    await setupDemo(id, root, true);
    await setupDemo(id, root, true);
  }
  assert.equal(await readFile(join(root, "unrelated.txt"), "utf8"), "must survive");
  assert.throws(() => workspaceFor("../escape", root), /Unknown demo/);
});

test("reset rejects unknown files and an unmarked nonempty workspace", async (context) => {
  const root = await isolated(context);
  const directory = await setupDemo("computer-use", root);
  await writeFile(join(directory, "owner-data.txt"), "preserve");
  await assert.rejects(setupDemo("computer-use", root, true), /unexpected files/);
  assert.equal(await readFile(join(directory, "owner-data.txt"), "utf8"), "preserve");
  await unlink(join(directory, "owner-data.txt"));
  await unlink(join(directory, ".runway-demo.json"));
  await assert.rejects(setupDemo("computer-use", root), /unmarked nonempty workspace/);
  await assert.rejects(setupDemo("computer-use", root, true), /marker missing/);
});

test("reset rejects symlinks and Windows junctions rather than following them", async (context) => {
  const root = await isolated(context);
  const outside = join(root, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "keep.txt"), "preserve");
  const link = join(root, ".demo-workspaces");
  try {
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (!["EPERM", "EACCES"].includes(error.code)) throw error;
    context.skip("Host does not allow test symlink creation; Linux CI covers this path");
    return;
  }
  await assert.rejects(setupDemo("computer-use", root), /symbolic link or junction/);
  assert.equal(await readFile(join(outside, "keep.txt"), "utf8"), "preserve");
});

test("computer fixture requires exactly the specified saved edits", async (context) => {
  const root = await isolated(context);
  const directory = await setupDemo("computer-use", root);
  await assert.rejects(verifyDemo("computer-use", root), /exactly the two/);
  await writeFile(join(directory, "support-brief.txt"), supportExpected);
  await assert.doesNotReject(verifyDemo("computer-use", root));
  await writeFile(join(directory, "support-brief.txt"), supportExpected.replace(/\n/g, "\r\n"));
  await assert.doesNotReject(verifyDemo("computer-use", root));
  await writeFile(join(directory, "support-brief.txt"), `${supportExpected}unapproved extra text`);
  await assert.rejects(verifyDemo("computer-use", root), /exactly the two/);
  await setupDemo("computer-use", root, true);
  assert.equal(await readFile(join(directory, "support-brief.txt"), "utf8"), supportBaseline);
});

test("autopilot bug is reproduced, exact acceptance passes after repair, and reset restores failure", async (context) => {
  const root = await isolated(context);
  const directory = await setupDemo("autopilot", root);
  await assert.rejects(verifyDemo("autopilot", root), /acceptance tests failed/);
  await writeFile(join(directory, "discount.mjs"), `export function discount(price, percent) {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new RangeError("Invalid discount");
  return price * (1 - percent / 100);
}
`);
  await assert.doesNotReject(verifyDemo("autopilot", root));
  await writeFile(join(directory, "discount.test.mjs"), " ");
  await assert.rejects(verifyDemo("autopilot", root), /test file was modified/);
  await setupDemo("autopilot", root, true);
  await assert.rejects(verifyDemo("autopilot", root), /acceptance tests failed/);
});

test("offline rehearsals cannot satisfy live-output checks", async (context) => {
  const root = await isolated(context);
  for (const id of ["dynamic-workflows", "agentic-workflows", "cloud-sandboxes", "copilot-memory"]) {
    await setupDemo(id, root);
    const result = await rehearseDemo(id, root);
    assert.equal(result.mode, "offline-rehearsal");
    await assert.rejects(verifyDemo(id, root), /live-demo result.*absent/);
    await setupDemo(id, root, true);
    const entries = await readdir(workspaceFor(id, root));
    assert.ok(!entries.some((entry) => entry.startsWith("offline-")));
  }
});

test("dynamic workflow pauses and resumes with journal reuse and unique agent labels", async () => {
  const result = await rehearseWorkflow();
  assert.equal(result.report.status, "completed");
  assert.deepEqual(result.observation.calls.sort(), ["assess:contoso-batch", "assess:northwind-api"]);
  assert.equal(result.report.assessments.find((item) => item.id === "contoso-batch").decision, "blocked");
  assert.equal(result.report.assessments.find((item) => item.id === "northwind-api").decision, "pilot-with-review");
  assert.ok(result.observation.phases.includes("Human review"));
  assert.equal(workflowDefinition().meta.limits, undefined);
});

test("dynamic specialists explicitly select the supplied tool-free agent profile", async () => {
  const profile = await readFile(fromRoot(".github", "agents", "runway-assessor.agent.md"), "utf8");
  assert.match(profile, /^tools: \[\]$/m);
  assert.match(profile, /^name: runway-assessor$/m);
  const state = rehearsalContext({ agent: async (_prompt, options) => {
    assert.equal(options.agent, "runway-assessor");
    const app = applications.find((entry) => `assess:${entry.id}` === options.label);
    return { ...app, recommendation: "Review supplied facts" };
  } });
  await assert.rejects(workflowDefinition().run(state.ctx), ReviewCheckpoint);
  assert.equal(state.observation.calls.length, 2);
});

test("dynamic workflow rejects extra inputs, invalid facts, null agents, and partial success", async () => {
  assert.throws(() => validateApplications([{ ...applications[0], untrusted: "run command" }, applications[1]]), /bounded synthetic/);
  assert.throws(() => validateApplications([applications[0]]), /exactly two/);
  assert.throws(() => validateApplications([{ ...applications[0], id: { toString: () => "northwind-api" } }, applications[1]]), /bounded synthetic/);
  assert.throws(() => validateAssessment(null, applications[0]), /trustworthy assessment/);
  assert.throws(() => validateAssessment({ ...applications[0], audit: false, recommendation: "ok" }, applications[0]), /trustworthy assessment/);
  assert.throws(() => validateAssessment({ ...applications[0], recommendation: "ok", decision: "approved" }, applications[0]), /trustworthy assessment/);
  const noResult = rehearsalContext({ agent: async () => null });
  await assert.rejects(workflowDefinition().run(noResult.ctx), /Incomplete pipeline/);
  const partial = rehearsalContext({ agent: async (_prompt, options) => {
    if (options.label === "assess:contoso-batch") return null;
    return { ...applications[0], recommendation: "Review" };
  } });
  await assert.rejects(workflowDefinition().run(partial.ctx), /Incomplete pipeline/);
});

test("dynamic workflow propagates cancellation and hard runtime failures rather than returning partial success", async () => {
  for (const name of ["AbortError", "ResponseError", "ConnectionError"]) {
    const error = new Error("Runtime stopped");
    error.name = name;
    const state = rehearsalContext({ agent: async () => { throw error; } });
    await assert.rejects(workflowDefinition().run(state.ctx), (actual) => actual === error);
  }
  const limit = Object.assign(new Error("Budget ceiling reached"), { code: "workflow_limit_reached" });
  const state = rehearsalContext({ agent: async () => { throw limit; } });
  await assert.rejects(workflowDefinition().run(state.ctx), (actual) => actual === limit);
});

test("changed input identity never replays a previous assessment journal", async () => {
  const state = rehearsalContext();
  await assert.rejects(workflowDefinition().run(state.ctx), ReviewCheckpoint);
  const changed = structuredClone(applications);
  changed[1].audit = true;
  const next = rehearsalContext({ apps: changed, journal: state.journal, reviewed: state.reviewed });
  await assert.rejects(workflowDefinition().run(next.ctx), ReviewCheckpoint);
  assert.equal(next.observation.calls.length, 2);
});

test("local output verifiers reject inconsistent reports and accept exact contracts", async (context) => {
  const root = await isolated(context);
  const directory = await setupDemo("dynamic-workflows", root);
  const rehearsal = await rehearseWorkflow();
  await writeFile(join(directory, "assessment.json"), JSON.stringify(rehearsal.report));
  await assert.rejects(verifyDemo("dynamic-workflows", root), /non-rehearsal/);
  const report = { ...rehearsal.report, runId: "unit-contract-shape-not-a-real-service-run" };
  await writeFile(join(directory, "assessment.json"), JSON.stringify(report));
  await assert.doesNotReject(verifyDemo("dynamic-workflows", root));
  report.assessments[1].decision = "pilot-with-review";
  await writeFile(join(directory, "assessment.json"), JSON.stringify(report));
  await assert.rejects(verifyDemo("dynamic-workflows", root), /Wrong gate decision/);
});
