import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repository = "synthetic-owner/synthetic-runway";
process.env.GITHUB_REPOSITORY = repository;
process.env.GH_TOKEN = "synthetic-local-test-token";
process.env.QUALITY_RUN_ID = "123";
const { origin } = await import("../scripts/release.mjs");
const { mergeRelease } = await import("../scripts/release.mjs");
const { digest } = await import("../scripts/automation.mjs");
const head = "a".repeat(40);

function responses(pulls, producer = {}) {
  return [
    { path: ".github/workflows/ci.yml", conclusion: "success", event: "pull_request", head_sha: head, head_repository: { full_name: repository } },
    pulls,
    { path: ".github/workflows/feature-producer.yml", status: "completed", conclusion: "success", event: "workflow_run", head_branch: "main", head_repository: { full_name: repository }, ...producer },
  ];
}

async function mockApi(values, action) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method });
    assert.ok(url.startsWith(`https://api.github.com/repos/${repository}/`));
    assert.equal(options.method, url.endsWith("/merge") ? "PUT" : "GET");
    assert.ok(values.length, "Unexpected additional GitHub API call");
    return { ok: true, status: 200, json: async () => values.shift() };
  };
  try {
    await action(calls);
  } finally {
    globalThis.fetch = previous;
  }
}

const releasePr = () => ({ state: "open", head: { sha: head, ref: "runway/automated-456" } });

test("release origin ignores ordinary PRs without minting credentials", async () => {
  await mockApi(responses([{ state: "open", head: { sha: head, ref: "ordinary-change" } }]), async (calls) => {
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
    await mockApi(fixtures(), async (calls) => {
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
      await mockApi(values, () => assert.rejects(mergeRelease(manifest, policy), error));
    }
});

test("release origin rejects fork validation, stale heads, and untrusted producer provenance", async () => {
  const fork = responses([releasePr()]);
  fork[0].head_repository.full_name = "untrusted/fork";
  await mockApi(fork, () => assert.rejects(origin(), /Untrusted validation/));
  for (const producer of [{ path: ".github/workflows/other.yml" }, { conclusion: "failure" }, { event: "workflow_dispatch" }, { head_branch: "untrusted" }, { head_repository: { full_name: "untrusted/fork" } }]) {
    await mockApi(responses([releasePr()], producer), () => assert.rejects(origin(), /not trusted/));
  }
  await mockApi(responses([{ ...releasePr(), head: { ...releasePr().head, sha: "b".repeat(40) } }]), async (calls) => {
    await origin();
    assert.equal(calls.length, 2);
  });
});

test("release waits for the trusted producer attestation and records only its exact run ID", async () => {
  const directory = await mkdtemp(join(tmpdir(), "runway-release-test-"));
  const previous = process.env.GITHUB_OUTPUT;
  process.env.GITHUB_OUTPUT = join(directory, "output");
  try {
    const values = responses([releasePr()]);
    values.splice(2, 0, { status: "in_progress" });
    let waits = 0;
    await mockApi(values, async () => origin({ wait: async () => { waits++; } }));
    assert.equal(waits, 1);
    assert.equal(await readFile(process.env.GITHUB_OUTPUT, "utf8"), "producer=456\n");
    const unfinished = responses([releasePr()]).slice(0, 2);
    unfinished.push(...Array.from({ length: 13 }, () => ({ status: "in_progress" })));
    await mockApi(unfinished, () => assert.rejects(origin({ wait: async () => {} }), /has not completed/));
  } finally {
    if (previous === undefined) delete process.env.GITHUB_OUTPUT;
    else process.env.GITHUB_OUTPUT = previous;
    await rm(directory, { recursive: true });
  }
});
