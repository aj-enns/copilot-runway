import { createHash } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fromRoot, readJson, write, isDate, isOfficialUrl, loadCatalog } from "./lib.mjs";
import { scan, fetchOfficial, plainText } from "./discover.mjs";

export const digest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);

export function inert(value, depth = 0, maxString = 20_000) {
  if (depth > 16) throw new Error("Automation data nesting exceeds limit");
  if (typeof value === "string" && (value.length > maxString || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))) throw new Error("Invalid automation string");
  if (value && typeof value === "object") {
    if (Object.keys(value).length > 500) throw new Error("Automation object exceeds limit");
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) throw new Error(`Forbidden data key: ${key}`);
      inert(item, depth + 1, maxString);
    }
  }
  return value;
}

export function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new Error(`Expected fields: ${required.join(", ")}; optional: ${optional.join(", ")}`);
  }
}

export function operationalPolicy(policy, publication = false) {
  if (policy.schemaVersion !== 1) throw new Error("Unsupported automation policy");
  if (policy.enabled !== true || policy.billingApproved !== true) throw new Error("Automation blocked: enablement and billing approval required");
  for (const [key, maximum] of [["maxItemsPerRun", 10], ["maxResearchDocuments", 40], ["maxTurns", 100], ["timeoutMinutes", 60]]) {
    if (!Number.isInteger(policy[key]) || policy[key] < 1 || policy[key] > maximum) throw new Error(`Automation blocked: configure ${key} between 1 and ${maximum}`);
  }
  if (!Number.isInteger(policy.reassessDays) || policy.reassessDays < 1 || policy.reassessDays > 30) throw new Error("Configure a reassessment interval between 1 and 30 days");
  if (publication && policy.publicationEnabled !== true) throw new Error("Automatic publication is disabled");
}

export function makeQueue(monitor, data, state, policy, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const items = monitor.items.map((item) => ({
    id: item.id, kind: "signal", url: item.url, title: item.title, publishedOn: item.publishedOn,
    summary: item.summary, revision: digest({ title: item.title, summary: item.summary, publishedOn: item.publishedOn }),
  })).filter((item) => state.signals[item.id]?.revision !== item.revision || state.signals[item.id]?.outcome === "pending");
  for (const item of items) {
    const previous = state.signals[item.id];
    if (previous?.outcome === "pending" && previous.revision === item.revision) item.priority = 3;
    item.attemptedOn = previous?.attemptedOn ?? "";
  }
  for (const feature of data.features) {
    const assessedOn = state.reviews[feature.id]?.assessedOn;
    const elapsed = assessedOn ? (now - new Date(`${assessedOn}T00:00:00Z`)) / 86_400_000 : Infinity;
    const humanElapsed = feature.verifiedOn ? (now - new Date(`${feature.verifiedOn}T00:00:00Z`)) / 86_400_000 : Infinity;
    if (elapsed >= policy.reassessDays) {
      items.push({ id: feature.id, kind: "review", title: feature.name, url: data.sources[feature.lifecycle.source].url, revision: digest({ id: feature.id, date }), priority: state.reviews[feature.id]?.outcome === "pending" ? 3 : humanElapsed >= data.rubric.reviewWindowDays ? 0 : 1, attemptedOn: state.reviews[feature.id]?.attemptedOn ?? "" });
    }
  }
  items.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || a.attemptedOn.localeCompare(b.attemptedOn) || a.id.localeCompare(b.id));
  return { schemaVersion: 1, date, total: items.length, omitted: Math.max(0, items.length - policy.maxItemsPerRun), items: items.slice(0, policy.maxItemsPerRun) };
}

export async function prepareResearch({ policy, data, watch, state, fetcher = fetch, now = new Date() }) {
  operationalPolicy(policy);
  const monitor = await scan(watch, fetcher);
  const queue = makeQueue(monitor, data, state, policy, now);
  const urls = new Set(queue.items.map((item) => item.url));
  for (const item of queue.items.filter((entry) => entry.kind === "review")) {
    const feature = data.features.find((entry) => entry.id === item.id);
    for (const ref of [feature.lifecycle.source, ...feature.readiness.flatMap((gate) => gate.sources), ...feature.cost.sources]) urls.add(data.sources[ref].url);
  }
  if (urls.size > policy.maxResearchDocuments) throw new Error(`Research needs ${urls.size} documents; exceeds approved maxResearchDocuments`);
  const documents = [];
  for (const url of urls) {
    const body = await fetchOfficial(url, watch.allowedHosts, fetcher);
    const text = plainText(body, 80_000);
    if (!text.trim()) throw new Error(`Official source has no usable text: ${url}`);
    documents.push({ url, fetchedOn: now.toISOString().slice(0, 10), sha256: digest(text), text });
  }
  return { schemaVersion: 1, runId: process.env.GITHUB_RUN_ID ?? "local", baseSha: process.env.GITHUB_SHA ?? "local", queue, documents };
}

export function validateCitation(citation, documents, allowedHosts) {
  exactKeys(citation, ["url", "sha256", "quote"]);
  if (!isOfficialUrl(citation.url, allowedHosts) || typeof citation.quote !== "string" || citation.quote.length < 20 || citation.quote.length > 1200) throw new Error("Invalid citation");
  const document = documents.find((entry) => entry.url === citation.url && entry.sha256 === citation.sha256);
  if (!document || !document.text.includes(citation.quote)) throw new Error("Citation does not match fetched evidence");
}

export function validateBundle(bundle, research, policy, allowedHosts) {
  inert(bundle);
  exactKeys(bundle, ["schemaVersion", "runId", "baseSha", "decisions"]);
  if (bundle.schemaVersion !== 1 || bundle.runId !== research.runId || bundle.baseSha !== research.baseSha) throw new Error("Research lineage mismatch");
  if (!Array.isArray(bundle.decisions) || bundle.decisions.length !== research.queue.items.length || bundle.decisions.length > policy.maxItemsPerRun) throw new Error("Every queued item needs exactly one decision");
  const ids = new Set();
  for (const decision of bundle.decisions) {
    exactKeys(decision, ["id", "outcome", "reason", "citations"], ["feature", "sources", "enterpriseUseCases", "findings"]);
    if (ids.has(decision.id) || !research.queue.items.some((item) => item.id === decision.id)) throw new Error("Unknown or duplicate queue item");
    ids.add(decision.id);
    if (!["feature", "review", "excluded", "unchanged", "pending"].includes(decision.outcome) || typeof decision.reason !== "string" || !decision.reason.trim() || decision.reason.length > 600) throw new Error("Invalid decision");
    if (!Array.isArray(decision.citations)) throw new Error("Citations must be an array");
    for (const citation of decision.citations) validateCitation(citation, research.documents, allowedHosts);
    if (["feature", "review"].includes(decision.outcome) && !decision.citations.length) throw new Error("Assessment requires grounded evidence");
    if (decision.outcome !== "feature" && ["feature", "sources", "enterpriseUseCases"].some((key) => Object.hasOwn(decision, key))) throw new Error("Unexpected feature fields");
    if (decision.outcome !== "review" && Object.hasOwn(decision, "findings")) throw new Error("Unexpected review findings");
    if (decision.outcome === "feature") {
      if (!idPattern.test(decision.feature?.id) || !decision.sources || typeof decision.sources !== "object" || !Array.isArray(decision.enterpriseUseCases)) throw new Error("Incomplete feature kit");
    }
  }
  return bundle;
}

export async function readBoundedJson(path, { research = false } = {}) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > (research ? 4_000_000 : 1_000_000)) throw new Error("Expected bounded regular JSON file");
  return inert(JSON.parse(await readFile(path, "utf8")), 0, research ? 80_000 : 20_000);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== "prepare" || process.argv.length !== 3) throw new Error("Usage: node scripts/automation.mjs prepare");
    const policy = await readJson(fromRoot("catalog", "automation.json"));
    operationalPolicy(policy);
    for (const [variable, field] of [["GH_AW_DEFAULT_MAX_TURNS", "maxTurns"], ["GH_AW_DEFAULT_TIMEOUT_MINUTES", "timeoutMinutes"]]) {
      if (Number(process.env[variable]) !== policy[field]) throw new Error(`Configure ${variable} to the approved ${field} before inference`);
    }
    const result = await prepareResearch({
      policy,
      data: await loadCatalog(),
      watch: await readJson(fromRoot("catalog", "watch.json")),
      state: await readJson(fromRoot("catalog", "automation-state.json")),
    });
    await write(fromRoot("catalog", "proposals", ".research.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Research prepared: ${result.queue.items.length} queued, ${result.queue.omitted} omitted, ${result.documents.length} documents. Human verification unchanged.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
