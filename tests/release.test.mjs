import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createReleaseService } from "../scripts/release.mjs";
import { digest } from "../scripts/automation.mjs";

const repository = "synthetic-owner/synthetic-runway";
const head = "a".repeat(40);

function responses(pulls, producer = {}) {
  return [
    { path: ".github/workflows/ci.yml", conclusion: "success", event: "pull_request", head_sha: head, head_repository: { full_name: repository } },
    pulls,
    { path: ".github/workflows/feature-producer.yml", status: "completed", conclusion: "success", event: "workflow_run", head_branch: "main", head_repository: { full_name: repository }, ...producer },
  ];
}

async function mockApi(values, action, overrides = {}) {
  const calls = [];
  const service = createReleaseService({
    repository, token: "synthetic-test-token", qualityRunId: "123",
    fetcher: async (url, options) => {
      calls.push({ url, method: options.method });
      assert.ok(url.startsWith(`https://api.github.com/repos/${repository}/`));
      assert.equal(options.method, url.endsWith("/merge") ? "PUT" : "GET");
      assert.ok(values.length, "Unexpected additional GitHub API call");
      return { ok: true, status: 200, json: async () => values.shift() };
    },
    ...overrides,
  });
  await action(calls, service);
}

const releasePr = () => ({ state: "open", head: { sha: head, ref: "runway/automated-456" } });

test("release origin ignores ordinary PRs without minting credentials", async () => {
  await mockApi(responses([{ state: "open", head: { sha: head, ref: "ordinary-change" } }]), async (calls, { origin, mergeRelease }) => {
    await origin();
    assert.equal(calls.length, 2);
  });
});

test("automatic merge requires exact attested content, strict protection, current base and successful checks", async () => {
    const base = "b".repeat(40);
    const content = Buffer.from("synthetic content").toString("base64");
    const policy = { schemaVersion: 1, enabled: true, publicationEnabled: true, billingApproved: true, maxItemsPerRun: 3, maxResearchDocuments: 20, maxTurns: 10, timeoutMinutes: 10, reassessDays: 7, requiredChecks: ["quality", "workflow-source"] };
    const manifest = { schemaVersion: 1, baseSha: base, researchRunId: "111", producerRunId: "456", headSha: head, prNumber: 42, files: [{ path: "catalog/automation-state.json", sha256: digest(content) }] };
    const fixtures = () => [
      { path: ".github/workflows/ci.yml", conclusion: "success", head_sha: head, event: "pull_request" },
      { required_status_checks: { strict: true, contexts: policy.requiredChecks } },
      { path: ".github/workflows/feature-producer.yml", conclusion: "success", event: "workflow_run", head_branch: "main", head_repository: { full_name: repository } },
      { state: "open", head: { sha: head, repo: { full_name: repository }, ref: "runway/automated-456" }, base: { sha: base }, number: 42 },
      { object: { sha: base } },
      [{ filename: "catalog/automation-state.json", status: "modified" }],
      { content },
      { total_count: 2, check_runs: policy.requiredChecks.map((name) => ({ name, head_sha: head, app: { slug: "github-actions" }, status: "completed", conclusion: "success" })) },
      { merged: true },
    ];
    await mockApi(fixtures(), async (calls, { origin, mergeRelease }) => {
      await mergeRelease(manifest, policy);
      assert.equal(calls.at(-1).method, "PUT");
    });
    for (const [index, mutate, error] of [
      [0, (value) => { value.head_sha = base; }, /Quality run/],
      [1, (value) => { value.required_status_checks.strict = false; }, /branch protection/],
      [2, (value) => { value.head_repository.full_name = "untrusted/fork"; }, /Untrusted producer/],
      [3, (value) => { value.head.sha = base; }, /head\/base changed/],
      [4, (value) => { value.object.sha = head; }, /Main advanced/],
      [5, (value) => { value[0].filename = "scripts/release.mjs"; }, /path set/],
      [6, (value) => { value.content = Buffer.from("tampered").toString("base64"); }, /content changed/],
      [7, (value) => { value.check_runs[0].conclusion = "failure"; }, /checks have not/],
      [8, (value) => { value.merged = false; }, /refused merge/],
    ]) {
      const values = fixtures();
      mutate(values[index]);
      await mockApi(values, (calls, { mergeRelease }) => assert.rejects(mergeRelease(manifest, policy), error));
    }
});

test("release origin rejects fork validation, stale heads, and untrusted producer provenance", async () => {
  const fork = responses([releasePr()]);
  fork[0].head_repository.full_name = "untrusted/fork";
  await mockApi(fork, (calls, { origin }) => assert.rejects(origin(), /Untrusted validation/));
  for (const producer of [{ path: ".github/workflows/other.yml" }, { conclusion: "failure" }, { event: "workflow_dispatch" }, { head_branch: "untrusted" }, { head_repository: { full_name: "untrusted/fork" } }]) {
    await mockApi(responses([releasePr()], producer), (calls, { origin }) => assert.rejects(origin(), /not trusted/));
  }
  await mockApi(responses([{ ...releasePr(), head: { ...releasePr().head, sha: "b".repeat(40) } }]), async (calls, { origin, mergeRelease }) => {
    await origin();
    assert.equal(calls.length, 2);
  });
});

test("release waits for the trusted producer attestation and records only its exact run ID", async () => {
  const outputs = [];
  const values = responses([releasePr()]);
  values.splice(2, 0, { status: "in_progress" });
  let waits = 0;
  await mockApi(values, (calls, service) => service.origin(), {
    wait: async () => { waits++; }, writeOutput: async (value) => outputs.push(value),
  });
  assert.equal(waits, 1);
  assert.deepEqual(outputs, ["producer=456\n"]);
  const unfinished = responses([releasePr()]).slice(0, 2);
  unfinished.push(...Array.from({ length: 13 }, () => ({ status: "in_progress" })));
  await mockApi(unfinished, (calls, service) => assert.rejects(service.origin(), /has not completed/), { wait: async () => {} });
});

test("release App identity uses an injected clock and repository-scoped permissions", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const outputs = [];
    const service = createReleaseService({
      repository, appId: "123", installationId: "456", privateKey,
      now: () => Date.parse("2026-10-19T03:00:00Z"),
      writeOutput: async (value) => outputs.push(value),
      fetcher: async (url, options) => {
        assert.equal(url, "https://api.github.com/app/installations/456/access_tokens");
        const jwt = options.headers.Authorization.slice("Bearer ".length);
        const [header, payload, signature] = jwt.split(".");
        assert.equal(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")), true);
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
        assert.deepEqual(claims, { iat: 1792378770, exp: 1792379100, iss: "123" });
        const body = JSON.parse(options.body);
        assert.deepEqual(body.repositories, ["synthetic-runway"]);
        assert.deepEqual(body.permissions, { contents: "write", pull_requests: "write", actions: "read", checks: "read", administration: "read" });
        return { ok: true, status: 200, json: async () => ({ token: "synthetic-installation-token" }) };
      },
    });
    await service.appToken();
    assert.deepEqual(outputs, ["token=synthetic-installation-token\n"]);
  });

test("trusted generation can pack allowlisted content without release credentials", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "runway-pack-test-"));
    const root = (...parts) => resolve(directory, ...parts);
    try {
      await mkdir(root("release-input"));
      await mkdir(root("catalog"));
      await writeFile(root("release-input", "proposal.json"), JSON.stringify({ baseSha: head, researchRunId: "111" }));
      await writeFile(root("catalog", "automation-state.json"), '{"schemaVersion":1}');
      const service = createReleaseService({
        repository, runId: "456", root,
        git: (...args) => args[0] === "rev-parse" ? head : args[0] === "diff" ? "catalog/automation-state.json" : "",
        fetcher: () => assert.fail("Packing must not contact GitHub"),
      });
      await service.pack();
      const manifest = JSON.parse(await readFile(root("release-output", "manifest.json"), "utf8"));
      assert.equal(manifest.producerRunId, "456");
      assert.equal(manifest.files[0].path, "catalog/automation-state.json");
      assert.equal(await readFile(root("release-output", "files", "catalog", "automation-state.json"), "utf8"), '{"schemaVersion":1}');
    } finally {
      await rm(directory, { recursive: true });
    }
  });
