import test from "node:test";
import assert from "node:assert/strict";
import { scoutSnapshot } from "../scripts/scout-status.mjs";

const repository = "example/runway";
const run = {
  id: 123,
  run_started_at: "2026-10-19T03:15:15Z",
  status: "completed",
  conclusion: "success",
};
const response = (runs) => async () => ({ ok: true, json: async () => ({ workflow_runs: runs }) });

test("local builds explicitly omit Scout metadata without network access", async () => {
  assert.deepEqual(await scoutSnapshot(undefined, { fetcher: () => assert.fail("Unexpected request") }), { state: "not-configured" });
});

test("Scout snapshot queries main in the configured repository and retains only public run metadata", async () => {
  const snapshot = await scoutSnapshot(repository, {
    token: "test-token",
    fetcher: async (url, options) => {
      assert.equal(url, `https://api.github.com/repos/${repository}/actions/workflows/preview-scout.lock.yml/runs?branch=main&per_page=1`);
      assert.equal(options.headers.Authorization, "Bearer test-token");
      return { ok: true, json: async () => ({ workflow_runs: [{ ...run, html_url: "https://untrusted.invalid", extra: "not public metadata" }] }) };
    },
  });
  assert.deepEqual(snapshot, {
    state: "recorded", startedAt: "2026-10-19T03:15:15.000Z",
    status: "completed", conclusion: "success",
    url: "https://github.com/example/runway/actions/runs/123",
  });
});

test("Scout snapshot distinguishes no runs, failed runs, and unfinished runs", async () => {
  assert.deepEqual(await scoutSnapshot(repository, { fetcher: response([]) }), { state: "no-runs" });
  for (const conclusion of ["failure", "cancelled", "skipped", "timed_out", "action_required"]) {
    const snapshot = await scoutSnapshot(repository, { fetcher: response([{ ...run, conclusion }]) });
    assert.equal(snapshot.conclusion, conclusion);
  }
  const snapshot = await scoutSnapshot(repository, { fetcher: response([{ ...run, run_started_at: null, created_at: run.run_started_at, status: "queued", conclusion: null }]) });
  assert.equal(snapshot.status, "queued");
  assert.equal(snapshot.conclusion, null);
  assert.equal(snapshot.startedAt, "2026-10-19T03:15:15.000Z");
});

test("Scout lookup failures and malformed metadata fail explicitly", async () => {
  await assert.rejects(scoutSnapshot("../invalid"), /Invalid GitHub repository/);
  await assert.rejects(scoutSnapshot(repository, { fetcher: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
  await assert.rejects(scoutSnapshot(repository, { fetcher: async () => { throw new Error("Network unavailable"); } }), /Network unavailable/);
  await assert.rejects(scoutSnapshot(repository, { fetcher: async () => ({ ok: true, json: async () => ({}) }) }), /Invalid Scout workflow response/);
  for (const patch of [{ id: "123" }, { run_started_at: "invalid" }, { status: "unknown" }, { conclusion: null }, { conclusion: "unknown" }]) {
    await assert.rejects(scoutSnapshot(repository, { fetcher: response([{ ...run, ...patch }]) }), /Invalid Scout run metadata/);
  }
});
