import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubClient, validateRepository } from "../scripts/github.mjs";
import { createReleaseService } from "../scripts/release.mjs";
import { postDigest } from "../scripts/post-digest.mjs";

test("GitHub transport shares JSON headers and supports explicit authentication overrides", async () => {
  const calls = [];
  const request = createGitHubClient({
    token: "synthetic-default",
    fetcher: async (url, options) => {
      calls.push({ url, ...options });
      return { ok: true, status: 200, json: async () => ({ id: 1 }) };
    },
  });
  assert.deepEqual(await request("/repos/example/runway"), { id: 1 });
  await request("/app/installations/123/access_tokens", { method: "POST", token: "synthetic-app-jwt", body: { repositories: ["runway"] } });
  assert.equal(calls[0].url, "https://api.github.com/repos/example/runway");
  assert.equal(calls[0].headers.Authorization, "Bearer synthetic-default");
  assert.equal(calls[0].headers["X-GitHub-Api-Version"], "2022-11-28");
  assert.equal(calls[1].headers.Authorization, "Bearer synthetic-app-jwt");
  assert.equal(calls[1].headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[1].body), { repositories: ["runway"] });
});

test("GitHub transport handles empty responses, anonymous reads, and failures without retries", async () => {
  const empty = createGitHubClient({ fetcher: async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, status: 204, json: () => assert.fail("204 must not parse JSON") };
  } });
  assert.equal(await empty("/installation/token", { method: "DELETE" }), null);
  let calls = 0;
  const failed = createGitHubClient({ fetcher: async () => {
    calls++;
    return { ok: false, status: 503 };
  } });
  await assert.rejects(failed("/repos/example/runway", { method: "POST", body: {} }), /HTTP 503/);
  assert.equal(calls, 1);
  await assert.rejects(failed("//other.invalid"), /relative/);
  assert.equal(calls, 1);
  for (const repository of ["../invalid", "owner/repo/extra", null]) assert.throws(() => validateRepository(repository), /Invalid GitHub repository/);
});

test("release services isolate repository, credentials and output without mutating globals", async () => {
  const previous = { repository: process.env.GITHUB_REPOSITORY, fetch: globalThis.fetch };
  const make = (repository) => createReleaseService({
    repository, token: `synthetic-${repository}`, qualityRunId: "1",
    fetcher: async (url, options) => {
      assert.ok(url.startsWith(`https://api.github.com/repos/${repository}/`));
      assert.equal(options.headers.Authorization, `Bearer synthetic-${repository}`);
      return { ok: true, status: 200, json: async () => url.endsWith("/pulls") ? [] : {
        path: ".github/workflows/ci.yml", conclusion: "success", event: "pull_request",
        head_sha: "a".repeat(40), head_repository: { full_name: repository },
      } };
    },
  });
  await Promise.all([make("example/first").origin(), make("example/second").origin()]);
  assert.equal(process.env.GITHUB_REPOSITORY, previous.repository);
  assert.equal(globalThis.fetch, previous.fetch);
  const unauthenticated = createReleaseService({
    repository: "example/runway", qualityRunId: "1",
    fetcher: () => assert.fail("Unauthenticated release must not send a request"),
  });
  await assert.rejects(unauthenticated.origin(), /token required/);
});

const monitor = {
  lastSuccessfulScan: "2026-10-19T03:15:15Z",
  items: [{ title: "Synthetic signal", signal: "update", publishedOn: "2026-10-19T00:00:00Z", url: "https://github.blog/changelog/synthetic/" }],
};

test("digest preserves exact-repository restrictions and deduplicates through injected transport", async () => {
  await assert.rejects(postDigest({
    repository: "example/fork", token: "synthetic", monitor,
    fetcher: () => assert.fail("Wrong repository must not send a request"),
  }), /exact Runway repository/);
  const calls = [];
  const options = {
    repository: "aj-enns/copilot-runway", token: "synthetic", monitor,
    fetcher: async (url, request) => {
      calls.push({ url, ...request });
      return { ok: true, status: 200, json: async () => request.method === "POST" ? { number: 1 } : [] };
    },
  };
  await postDigest(options);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST"]);
  const body = JSON.parse(calls[1].body).body;
  assert.match(body, /Candidate signals only/);
  await postDigest({ ...options, fetcher: async (url, request) => {
    assert.equal(request.method, "GET");
    return { ok: true, status: 200, json: async () => [{ number: 1, user: { login: "github-actions[bot]" }, body }] };
  } });
});
