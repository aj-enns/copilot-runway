import { exactKeys, idPattern } from "../shared/validation.mjs";
import { pathToFileURL } from "node:url";
import { appendFile } from "node:fs/promises";
import { fromRoot, readJson, write, loadCatalog, isOfficialUrl } from "./lib.mjs";
import { operationalPolicy, validateBundle, readBoundedJson } from "./automation.mjs";
import { validateCatalog } from "./validate.mjs";
import { validateRecipe } from "../shared/recipes.mjs";

function text(value, maximum, label) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(`${label}: concise text of at most ${maximum} characters required`);
}

function textList(value, maximumItems, maximumText, label) {
  if (!Array.isArray(value) || !value.length || value.length > maximumItems) throw new Error(`${label}: bounded nonempty list required`);
  value.forEach((entry) => text(entry, maximumText, label));
}

export function applyBundle(bundle, research, policy, data, watch, state) {
  operationalPolicy(policy);
  validateBundle(bundle, research, policy, watch.allowedHosts);
  const result = structuredClone(data);
  const nextState = structuredClone(state);
  const date = research.queue.date;
  const provenance = (citations) => ({
    kind: "automated", assessedOn: date, runId: research.runId,
    sourceHashes: citations.map(({ url, sha256 }) => ({ url, sha256 })),
  });
  let changed = 0;
  for (const decision of bundle.decisions) {
    const queued = research.queue.items.find((item) => item.id === decision.id);
    if (decision.outcome === "feature") {
      if (queued.kind !== "signal") throw new Error("A review cannot create a new feature");
      const feature = structuredClone(decision.feature);
      exactKeys(feature, ["id", "name", "tagline", "summary", "category", "icon", "featured", "lifecycle", "surfaces", "tags", "verifiedOn", "value", "enablement", "cost", "limitations", "readiness", "demo"]);
      for (const [field, limit] of [["name", 80], ["tagline", 160], ["summary", 600], ["category", 40]]) text(feature[field], limit, field);
      for (const [field, count, limit] of [["surfaces", 5, 60], ["tags", 8, 40], ["value", 5, 240], ["limitations", 8, 360]]) textList(feature[field], count, limit, field);
      if (result.features.some((entry) => entry.id === feature.id || entry.name.toLowerCase() === feature.name?.toLowerCase())) throw new Error("Feature already exists; use a review decision");
      if (feature.verifiedOn !== null || feature.featured !== false) throw new Error("Automated content cannot claim human verification or featured status");
      if (feature.icon !== "apps") throw new Error("Automated kits use the trusted apps icon");
      exactKeys(feature.lifecycle, ["status", "source", "note"]);
      text(feature.lifecycle.note, 400, "Lifecycle note");
      if (feature.lifecycle.status !== "unverified") throw new Error("Machine lifecycle signals must remain unverified until human source review");
      exactKeys(feature.cost, ["headline", "detail", "assumptions", "sources"]);
      text(feature.cost.headline, 180, "Cost headline");
      text(feature.cost.detail, 600, "Cost detail");
      textList(feature.cost.assumptions, 6, 240, "Cost assumptions");
      if (!Array.isArray(feature.enablement) || !feature.enablement.length || feature.enablement.length > 6) throw new Error("One to six enablement steps required");
      for (const step of feature.enablement) {
        exactKeys(step, ["title", "detail", "command", "sources"]);
        text(step.title, 80, "Enablement title");
        text(step.detail, 400, "Enablement detail");
        if (step.command !== "") throw new Error("Automated enablement must not invent executable commands");
      }
      for (const gate of feature.readiness) {
        exactKeys(gate, ["gate", "status", "reason", "sources", "next"]);
        text(gate.reason, 400, "Gate reason");
        text(gate.next, 240, "Gate next action");
        if (!["unknown", "fail"].includes(gate.status)) throw new Error("Automated findings cannot promote readiness");
      }
      exactKeys(feature.demo, ["title", "minutes", "mode", "status", "liveStatus", "runbook", "prompt", "expected", "remoteCleanup", "recipe"]);
      for (const [field, limit] of [["title", 100], ["mode", 80], ["prompt", 2000], ["expected", 1000], ["remoteCleanup", 600]]) text(feature.demo[field], limit, `Demo ${field}`);
      if (!Number.isInteger(feature.demo.minutes) || feature.demo.minutes < 1 || feature.demo.minutes > 30) throw new Error("Demo must be 1 to 30 minutes");
      if (!feature.demo.recipe || feature.demo.liveStatus !== "not-run" || feature.demo.status !== "kit-tested") throw new Error("Only tested offline recipes with no live claim can publish");
      validateRecipe(feature.demo.recipe);
      feature.provenance = provenance(decision.citations);
      const sourceIds = new Set(Object.keys(decision.sources));
      for (const [id, source] of Object.entries(decision.sources)) {
        if (!idPattern.test(id)) throw new Error("Invalid source ID");
        exactKeys(source, ["title", "shortTitle", "url", "publisher", "kind", "verifiedOn"]);
        for (const [field, limit] of [["title", 180], ["shortTitle", 40], ["publisher", 40], ["kind", 40]]) text(source[field], limit, `Source ${field}`);
        if (result.sources[id]) throw new Error("Automated features cannot overwrite a source");
        if (source.verifiedOn !== null || !isOfficialUrl(source.url, watch.allowedHosts) || !decision.citations.some((citation) => citation.url === source.url)) throw new Error("Source lacks machine evidence or claims human verification");
        result.sources[id] = { ...source, provenance: provenance(decision.citations.filter((citation) => citation.url === source.url)) };
      }
      const refs = [feature.lifecycle.source, ...feature.cost.sources, ...feature.enablement.flatMap((step) => step.sources), ...feature.readiness.flatMap((gate) => gate.sources)];
      if (refs.some((id) => !sourceIds.has(id))) throw new Error("New features must cite their own grounded machine sources");
      result.features.push(feature);
      result.enterpriseUseCases[feature.id] = decision.enterpriseUseCases;
      changed++;
    } else if (decision.outcome === "review") {
      if (queued.kind !== "review") throw new Error("Review must target an existing queued feature");
      const feature = result.features.find((entry) => entry.id === decision.id);
      if (!feature || !Array.isArray(decision.findings) || decision.findings.length !== result.rubric.gates.length) throw new Error("Review needs every gate");
      const gateIds = new Set();
      for (const finding of decision.findings) {
        exactKeys(finding, ["gate", "status", "reason", "next"]);
        text(finding.reason, 400, "Review reason");
        text(finding.next, 240, "Review next action");
        if (!["unknown", "fail"].includes(finding.status) || gateIds.has(finding.gate) || !result.rubric.gates.some((gate) => gate.id === finding.gate)) throw new Error("Invalid conservative review finding");
        gateIds.add(finding.gate);
      }
      feature.automatedReview = { ...provenance(decision.citations), reason: decision.reason, findings: decision.findings };
      nextState.reviews[feature.id] = { assessedOn: date, sourceHashes: provenance(decision.citations).sourceHashes };
      changed++;
    }
    const record = { revision: queued.revision, outcome: decision.outcome, reason: decision.reason, attemptedOn: date, runId: research.runId, ...(decision.outcome === "pending" ? {} : { assessedOn: date }) };
    if (queued.kind === "signal") nextState.signals[decision.id] = { ...nextState.signals[decision.id], ...record };
    if (queued.kind === "review") nextState.reviews[decision.id] = { ...nextState.reviews[decision.id], ...record };
  }
  validateCatalog(result, watch);
  return { data: result, state: nextState, changed, outcomes: bundle.decisions.map(({ id, outcome, reason }) => ({ id, outcome, reason })) };
}

export async function materialize(bundle, research) {
  const [policy, data, watch, state, catalog, sources] = await Promise.all([
    readJson(fromRoot("catalog", "automation.json")), loadCatalog(),
    readJson(fromRoot("catalog", "watch.json")), readJson(fromRoot("catalog", "automation-state.json")),
    readJson(fromRoot("catalog", "features.json")), readJson(fromRoot("catalog", "sources.json")),
  ]);
  const result = applyBundle(bundle, research, policy, data, watch, state);
  catalog.features = result.data.features;
  catalog.enterpriseUseCases = result.data.enterpriseUseCases;
  sources.sources = result.data.sources;
  // These are human-review dates; automated research does not renew them.
  await write(fromRoot("catalog", "features.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  await write(fromRoot("catalog", "sources.json"), `${JSON.stringify(sources, null, 2)}\n`);
  await write(fromRoot("catalog", "automation-state.json"), `${JSON.stringify(result.state, null, 2)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: node scripts/materialize.mjs BUNDLE_JSON RESEARCH_JSON");
    const result = await materialize(await readBoundedJson(process.argv[2]), await readBoundedJson(process.argv[3], { research: true }));
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${result.changed}\n`);
    console.log(JSON.stringify({ changed: result.changed, outcomes: result.outcomes }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
