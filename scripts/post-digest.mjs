import { createHash } from "node:crypto";
import { fromRoot, readJson } from "./lib.mjs";

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (repository !== "hammadorg93/copilot-runway" || !token) {
  throw new Error("Digest writes require the exact Runway repository and a scoped Actions token");
}
const monitor = await readJson(fromRoot("catalog", "monitor.json"));
if (!monitor.lastSuccessfulScan || !monitor.items.length) throw new Error("A nonempty, successful official-source scan is required");
const marker = "<!-- copilot-runway-radar:v1 -->";
const digest = createHash("sha256").update(JSON.stringify(monitor.items)).digest("hex");
const digestMarker = `<!-- runway-digest-sha256:${digest} -->`;
const safe = (text) => String(text).replace(/[\r\n]/g, " ").replace(/[\\`*_{}\[\]<>|]/g, "\\$&").replace(/@/g, "@\u200b");
const rows = monitor.items.slice(0, 30).map((item) =>
  `| ${safe(item.title)} | ${item.signal} | ${item.publishedOn.slice(0, 10)} | [Official source](${encodeURI(item.url).replace(/[()]/g, (value) => encodeURIComponent(value))}) |`).join("\n");
const body = `${marker}\n${digestMarker}\n### Official-source discovery digest\n\n` +
  `Candidate signals only. No catalog entry, lifecycle, readiness finding, or last-verified date was automatically promoted.\n\n` +
  `| Candidate | Signal | Published | Evidence |\n| --- | --- | --- | --- |\n${rows}\n\n` +
  `Showing ${Math.min(30, monitor.items.length)} of ${monitor.items.length} signals. See the Pages Radar or scan artifact for the full bounded snapshot.\n\n` +
  `Review preview, GA, retirement, policy, billing, and version changes. Failed scans must be investigated. ` +
  `Agentic interpretation is opt-in and may create only a draft proposal PR; maintainers own admission and evidence.\n\n` +
  `Generated from public GitHub sources by the deterministic Runway monitor.`;

async function api(path, method = "GET", payload) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    method,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub digest API ${method} failed with HTTP ${response.status}`);
  return response.json();
}

const existing = [];
for (let page = 1; page <= 5; page++) {
  const issues = await api(`issues?state=open&per_page=100&page=${page}`);
  existing.push(...issues.filter((issue) => !issue.pull_request &&
    issue.user?.login === "github-actions[bot]" && issue.body?.includes(marker)));
  if (issues.length < 100) break;
  if (page === 5) throw new Error("Digest deduplication exceeded its bounded search; refusing to create a duplicate");
}
if (existing.length > 1) throw new Error("Multiple bot-owned Radar digest issues exist; maintainer review is required");
if (existing[0]?.body?.includes(digestMarker)) {
  console.log("Official-source digest is unchanged; no issue mutation.");
} else if (existing.length) {
  await api(`issues/${existing[0].number}`, "PATCH", { body });
  console.log(`Updated the existing bot-owned Radar digest issue ${existing[0].number}.`);
} else {
  const issue = await api("issues", "POST", { title: "[Runway Radar] Official-source discovery", body });
  console.log(`Created Radar digest issue ${issue.number}.`);
}
