import { createGitHubClient, validateRepository } from "./github.mjs";
import { createSign } from "node:crypto";
import { readFile, mkdir, copyFile, lstat, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { fromRoot, readJson, write, assertNoSymlink } from "./lib.mjs";
import { digest, readBoundedJson, operationalPolicy } from "./automation.mjs";

const numeric = (value) => {
  if (!/^[1-9]\d*$/.test(String(value))) throw new Error("Expected positive numeric GitHub identifier");
  return String(value);
};
const sha = (value) => {
  if (!/^[a-f0-9]{40}$/.test(value)) throw new Error("Expected exact Git commit SHA");
  return value;
};
const git = (...args) => execFileSync("git", args, { cwd: fromRoot(), encoding: "utf8" }).trim();

export function allowedReleasePath(path) {
  return /^(catalog\/(features|sources|automation-state)\.json|artifacts\/manifest\.json|artifacts\/slides\/[a-z0-9-]+\.pptx|features\/[a-z0-9-]+\/assessment\.md|demos\/[a-z0-9-]+\/README\.md)$/.test(path);
}

export function validateAttestation(attestation) {
  if (attestation.schemaVersion !== 1 || !Array.isArray(attestation.files) || !attestation.files.length || attestation.files.length > 100) throw new Error("Invalid release manifest");
  sha(attestation.baseSha);
  numeric(attestation.researchRunId);
  numeric(attestation.producerRunId);
  const paths = new Set();
  for (const file of attestation.files) {
    if (!allowedReleasePath(file.path) || paths.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`Disallowed release file: ${file.path}`);
    paths.add(file.path);
  }
}

export function eligibleChecks(checks, required, headSha) {
  if (!required.length) throw new Error("Required checks cannot be empty");
  return required.every((name) => {
    const matches = checks.filter((check) => check.name === name && check.head_sha === headSha && check.app?.slug === "github-actions");
    return matches.length > 0 && matches.every((check) => check.status === "completed" && check.conclusion === "success");
  });
}

export function createReleaseService({
  repository: repo, token, qualityRunId, researchRunId, runId, appId, installationId, privateKey,
  fetcher = fetch, wait: defaultWait = delay, now = Date.now, git: runGit = git, root = fromRoot,
  writeOutput = async () => { throw new Error("Actions output writer required"); },
}) {
  validateRepository(repo);
  const request = createGitHubClient({ token, fetcher });
  const api = (path, options = {}) => {
    if (!(options.token ?? token)) throw new Error("Repository identity and GitHub token required");
    return request(path, options);
  };
  const repoApi = (suffix) => `/repos/${repo}${suffix}`;
  const fromRoot = root;
  const git = runGit;
  async function selectProposal() {
    const runId = numeric(researchRunId);
    const run = await api(repoApi(`/actions/runs/${runId}`));
    if (run.path !== ".github/workflows/preview-scout.lock.yml" || run.conclusion !== "success" || run.head_repository.full_name !== repo || run.head_branch !== "main") throw new Error("Untrusted research run");
    const research = await readBoundedJson(fromRoot("release-input", ".research.json"), { research: true });
    if (research.runId !== runId || research.baseSha !== run.head_sha) throw new Error("Research artifact lineage mismatch");
    if (research.queue.items.length === 0) {
      await writeOutput("noChanges=true\n");
      console.log("No queued work; no release is needed.");
      return;
    }
    const pulls = await api(repoApi("/pulls?state=open&per_page=100"));
    const marker = `Research run: https://github.com/${repo}/actions/runs/${runId}`;
    const matches = pulls.filter((pr) => pr.user.login === "github-actions[bot]" && pr.head.repo?.full_name === repo && pr.base.ref === "main" && pr.body?.includes(marker));
    if (matches.length !== 1) throw new Error(`Research incomplete: expected one proposal PR for this run, found ${matches.length}`);
    const pr = matches[0];
    const files = await api(repoApi(`/pulls/${pr.number}/files?per_page=100`));
    if (files.length !== 1 || files[0].filename !== "catalog/proposals/runway-batch.json" || !["added", "modified"].includes(files[0].status)) throw new Error("Research PR must contain only the structured bundle");
    const file = await api(repoApi(`/contents/catalog/proposals/runway-batch.json?ref=${sha(pr.head.sha)}`));
    if (file.size > 1_000_000 || file.encoding !== "base64") throw new Error("Unbounded proposal");
    const bundle = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
    if (bundle.runId !== runId || bundle.baseSha !== run.head_sha) throw new Error("Proposal does not belong to completed research run");
    await write(fromRoot("release-input", "bundle.json"), `${JSON.stringify(bundle)}\n`);
    await write(fromRoot("release-input", "proposal.json"), `${JSON.stringify({ number: pr.number, researchRunId: runId, baseSha: run.head_sha })}\n`);
  }

  async function origin({ wait = defaultWait } = {}) {
    const run = await api(repoApi(`/actions/runs/${numeric(qualityRunId)}`));
    if (run.path !== ".github/workflows/ci.yml" || run.conclusion !== "success" || run.event !== "pull_request" || run.head_repository.full_name !== repo) throw new Error("Untrusted validation run");
    const pulls = await api(repoApi(`/commits/${sha(run.head_sha)}/pulls`));
    const matches = pulls.filter((pr) => pr.state === "open" && pr.head.sha === run.head_sha && /^runway\/automated-[1-9]\d*$/.test(pr.head.ref));
    if (matches.length === 0) {
      console.log("Not an automatic content release; no action.");
      return;
    }
    if (matches.length !== 1) throw new Error("Ambiguous release PR");
    const id = matches[0].head.ref.split("-").at(-1);
    let producer;
    for (let attempt = 0; attempt < 13; attempt++) {
      producer = await api(repoApi(`/actions/runs/${numeric(id)}`));
      if (producer.status === "completed") break;
      if (attempt === 12) throw new Error("Producer has not completed; rerun release after its attestation is uploaded");
      await wait(5_000);
    }
    if (producer.path !== ".github/workflows/feature-producer.yml" || producer.conclusion !== "success" || producer.event !== "workflow_run" || producer.head_branch !== "main" || producer.head_repository.full_name !== repo) throw new Error("Producer run is not trusted");
    await writeOutput(`producer=${id}\n`);
  }

  async function pack() {
    const proposal = await readJson(fromRoot("release-input", "proposal.json"));
    if (git("rev-parse", "HEAD") !== proposal.baseSha) throw new Error("Producer checkout does not match research base");
    const paths = [...new Set([
      ...git("diff", "--name-only").split("\n"),
      ...git("ls-files", "--others", "--exclude-standard").split("\n"),
    ])].filter(Boolean).filter((path) => !/^(release-input|release-output)\//.test(path));
    if (!paths.length) throw new Error("No release content produced");
    const files = [];
    for (const path of paths) {
      if (!allowedReleasePath(path)) throw new Error(`Unexpected producer change: ${path}`);
      const input = fromRoot(...path.split("/"));
      await assertNoSymlink(input, fromRoot());
      const stat = await lstat(input);
      if (!stat.isFile() || stat.size > 10_000_000) throw new Error("Release files must be bounded regular files");
      const bytes = await readFile(input);
      const output = fromRoot("release-output", "files", ...path.split("/"));
      await mkdir(dirname(output), { recursive: true });
      await copyFile(input, output);
      files.push({ path, sha256: digest(bytes.toString("base64")) });
    }
    const attestation = { schemaVersion: 1, ...proposal, producerRunId: numeric(runId), files };
    validateAttestation(attestation);
    await write(fromRoot("release-output", "manifest.json"), `${JSON.stringify(attestation, null, 2)}\n`);
  }

  async function verifyFiles(directory, manifest) {
    validateAttestation(manifest);
    for (const file of manifest.files) {
      const path = resolve(directory, "files", ...file.path.split("/"));
      await assertNoSymlink(path, directory);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.size > 10_000_000 || digest((await readFile(path)).toString("base64")) !== file.sha256) throw new Error(`Release digest mismatch: ${file.path}`);
    }
  }

  async function appToken() {
    const application = numeric(appId);
    const installation = numeric(installationId);
    const key = privateKey;
    if (!key) throw new Error("Release App private key is missing");
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const issuedAt = Math.floor(now() / 1000);
    const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: issuedAt - 30, exp: issuedAt + 300, iss: application })}`;
    const signer = createSign("RSA-SHA256");
    signer.update(payload);
    const jwt = `${payload}.${signer.sign(key, "base64url")}`;
    const value = await api(`/app/installations/${installation}/access_tokens`, {
      method: "POST", token: jwt, body: { repositories: [repo.split("/")[1]], permissions: { contents: "write", pull_requests: "write", actions: "read", checks: "read", administration: "read" } },
    });
    console.log(`::add-mask::${value.token}`);
    await writeOutput(`token=${value.token}\n`);
  }

  async function publish() {
    operationalPolicy(await readJson(fromRoot("catalog", "automation.json")), true);
    const directory = fromRoot("release-output");
    const manifest = await readBoundedJson(resolve(directory, "manifest.json"));
    await verifyFiles(directory, manifest);
    if (String(manifest.producerRunId) !== runId) throw new Error("Cross-run artifact refused");
    const head = await api(repoApi("/git/ref/heads/main"));
    if (head.object.sha !== manifest.baseSha) throw new Error("Base branch changed; rerun research rather than overwrite newer content");
    const entries = [];
    for (const file of manifest.files) {
      const blob = await api(repoApi("/git/blobs"), { method: "POST", body: { encoding: "base64", content: (await readFile(resolve(directory, "files", ...file.path.split("/")))).toString("base64") } });
      entries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const parent = await api(repoApi(`/git/commits/${manifest.baseSha}`));
    const tree = await api(repoApi("/git/trees"), { method: "POST", body: { base_tree: parent.tree.sha, tree: entries } });
    const commit = await api(repoApi("/git/commits"), { method: "POST", body: { message: "Publish automated Runway feature evidence and kits\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>", tree: tree.sha, parents: [manifest.baseSha] } });
    const branch = `runway/automated-${manifest.producerRunId}`;
    await api(repoApi("/git/refs"), { method: "POST", body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
    const pr = await api(repoApi("/pulls"), { method: "POST", body: {
      title: "[Runway Release] Validated automated feature kits", head: branch, base: "main",
      body: `## Change\nAutomated data-only feature kits and conservative evidence reviews.\n\n## Evidence\n- Official sources and verified dates: see canonical source records; human dates unchanged.\n- Exact lifecycle and account/platform scope: unverified machine signals, not tenant approval.\n- Facts versus recommendations/assumptions: grounded citations and machine provenance included.\n- Required unknowns or conditions: required unknowns remain blocking.\n\nProducer run: https://github.com/${repo}/actions/runs/${manifest.producerRunId}\nResearch run: https://github.com/${repo}/actions/runs/${manifest.researchRunId}\n\n## Acceptance\n- [x] No customer, personal, confidential, or credential data\n- [x] Every required gate assessed; unknowns remain blocking\n- [x] Current cost assumptions and separate remote cleanup are explicit\n- [x] Artifacts regenerated when catalog/rubric evidence changed\n- [x] \`npm run check\` and slide checks pass\n- [x] Live validation is not claimed from an offline fixture test\n- [x] Agentic Markdown and lock regenerated together when configuration changed (not changed by this release)\n\nValidation: \`npm run check\` passed; \`npm run artifacts:check\` passed; \`python scripts/verify_pptx.py\` passed in trusted producer. Required exact-head CI must also pass before merge.\n\n<!-- runway-release:${manifest.producerRunId} -->`,
    } });
    const release = { ...manifest, headSha: commit.sha, prNumber: pr.number };
    await write(fromRoot("release-attestation", "manifest.json"), `${JSON.stringify(release, null, 2)}\n`);
    console.log(`Created release PR #${pr.number} for ${commit.sha}`);
  }

  async function merge() {
    const policy = await readJson(fromRoot("catalog", "automation.json"));
    const manifest = await readBoundedJson(fromRoot("release-attestation", "manifest.json"));
    return mergeRelease(manifest, policy);
  }

  async function mergeRelease(manifest, policy) {
    operationalPolicy(policy, true);
    validateAttestation(manifest);
    sha(manifest.headSha);
    const quality = await api(repoApi(`/actions/runs/${numeric(qualityRunId)}`));
    if (quality.path !== ".github/workflows/ci.yml" || quality.conclusion !== "success" || quality.head_sha !== manifest.headSha || quality.event !== "pull_request") throw new Error("Quality run does not validate this release head");
    const protection = await api(repoApi("/branches/main/protection"));
    if (!protection.required_status_checks?.strict || !policy.requiredChecks.every((name) =>
      protection.required_status_checks.contexts.includes(name) || protection.required_status_checks.checks?.some((check) => check.context === name))) {
      throw new Error("Automatic release requires strict up-to-date branch protection with all required checks; rules are never bypassed");
    }
    const producer = await api(repoApi(`/actions/runs/${numeric(manifest.producerRunId)}`));
    if (producer.path !== ".github/workflows/feature-producer.yml" || producer.conclusion !== "success" || producer.event !== "workflow_run" || producer.head_branch !== "main" || producer.head_repository.full_name !== repo) throw new Error("Untrusted producer attestation");
    const pr = await api(repoApi(`/pulls/${numeric(manifest.prNumber)}`));
    if (pr.head.sha !== manifest.headSha || pr.base.sha !== manifest.baseSha || pr.head.repo.full_name !== repo || pr.state !== "open" || pr.head.ref !== `runway/automated-${manifest.producerRunId}`) throw new Error("Release head/base changed");
    const main = await api(repoApi("/git/ref/heads/main"));
    if (main.object.sha !== manifest.baseSha) throw new Error("Main advanced; regenerate release on current base");
    const files = await api(repoApi(`/pulls/${pr.number}/files?per_page=100`));
    if (files.length !== manifest.files.length || files.some((file) => !["added", "modified"].includes(file.status) || !manifest.files.some((entry) => entry.path === file.filename))) throw new Error("Release path set changed");
    for (const entry of manifest.files) {
      const contents = await api(repoApi(`/contents/${entry.path}?ref=${manifest.headSha}`));
      const bytes = contents.content ? Buffer.from(contents.content, "base64") : Buffer.from((await api(repoApi(`/git/blobs/${contents.sha}`))).content, "base64");
      if (digest(bytes.toString("base64")) !== entry.sha256) throw new Error(`Release content changed: ${entry.path}`);
    }
    const checks = await api(repoApi(`/commits/${manifest.headSha}/check-runs?per_page=100`));
    if (checks.total_count > 100 || !eligibleChecks(checks.check_runs, policy.requiredChecks, manifest.headSha)) throw new Error("Required exact-head checks have not all succeeded");
    const result = await api(repoApi(`/pulls/${pr.number}/merge`), { method: "PUT", body: { sha: manifest.headSha, merge_method: "merge" } });
    if (!result.merged) throw new Error("GitHub refused merge; branch rules are not bypassed");
    console.log(`Merged #${pr.number}; Pages deployment must succeed separately.`);
  }

  return { select: selectProposal, pack, origin, appToken, publish, merge, mergeRelease,
    revoke: () => api("/installation/token", { method: "DELETE" }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const service = createReleaseService({
      repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN,
      qualityRunId: process.env.QUALITY_RUN_ID, researchRunId: process.env.RESEARCH_RUN_ID,
      runId: process.env.GITHUB_RUN_ID, appId: process.env.RUNWAY_APP_ID,
      installationId: process.env.RUNWAY_APP_INSTALLATION_ID, privateKey: process.env.RUNWAY_APP_PRIVATE_KEY,
      writeOutput: (value) => appendFile(process.env.GITHUB_OUTPUT, value),
    });
    const commands = { ...service, "app-token": service.appToken };
    delete commands.appToken;
    delete commands.mergeRelease;
    if (process.argv.length !== 3 || !Object.hasOwn(commands, process.argv[2])) throw new Error("Usage: node scripts/release.mjs select|pack|origin|app-token|publish|merge|revoke");
    await commands[process.argv[2]]();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
