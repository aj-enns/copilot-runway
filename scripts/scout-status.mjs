import { createGitHubClient, validateRepository } from "./github.mjs";

const statuses = ["queued", "in_progress", "completed", "waiting", "requested", "pending"];
const conclusions = ["success", "failure", "neutral", "cancelled", "skipped", "timed_out", "action_required", "stale", "startup_failure"];

export async function scoutSnapshot(repository, { token, fetcher = fetch } = {}) {
  if (!repository) return { state: "not-configured" };
  validateRepository(repository);
  const api = createGitHubClient({ token, fetcher });
  const payload = await api(`/repos/${repository}/actions/workflows/preview-scout.lock.yml/runs?branch=main&per_page=1`);
  if (!Array.isArray(payload.workflow_runs)) throw new Error("Invalid Scout workflow response");
  if (!payload.workflow_runs.length) return { state: "no-runs" };
  const run = payload.workflow_runs[0];
  const startedAt = run.run_started_at ?? run.created_at;
  if (!Number.isSafeInteger(run.id) || run.id <= 0 ||
      typeof startedAt !== "string" || !Number.isFinite(Date.parse(startedAt)) ||
      !statuses.includes(run.status) ||
      (run.status === "completed" ? !conclusions.includes(run.conclusion) : run.conclusion !== null)) {
    throw new Error("Invalid Scout run metadata");
  }
  return {
    state: "recorded",
    startedAt: new Date(startedAt).toISOString(),
    status: run.status,
    conclusion: run.conclusion,
    url: `https://github.com/${repository}/actions/runs/${run.id}`,
  };
}
