import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fromRoot, loadCatalog, readJson, isOfficialUrl, isDate, fingerprint, assessmentMarkdown } from "./lib.mjs";
import { inert } from "./automation.mjs";

const statuses = new Set(["pass", "conditional", "unknown", "fail"]);
const lifecycles = new Set(["public-preview", "technical-preview", "experimental", "ga", "retired", "unverified"]);
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function validateCatalog(data, watch, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const validDate = (value, label) => check(isDate(value) && value <= today, `${label}: invalid or future date`);
  const machineDate = (record, label) => {
    check(record.verifiedOn === null && record.provenance?.kind === "automated", `${label}: missing human verification must be explicit`);
    validDate(record.provenance?.assessedOn, `${label} assessedOn`);
    check(Array.isArray(record.provenance?.sourceHashes) && record.provenance.sourceHashes.length > 0 &&
      record.provenance.sourceHashes.every((entry) => isOfficialUrl(entry.url, watch.allowedHosts) && /^[a-f0-9]{64}$/.test(entry.sha256)),
    `${label}: machine evidence hashes required`);
  };
  inert(data);
  check(data.schemaVersion === 1, "Unsupported catalog schemaVersion");
  validDate(data.updatedOn, "Catalog updatedOn");
  check(data.rubric.schemaVersion === 1, "Unsupported rubric schemaVersion");
  check(/^\d+\.\d+\.\d+$/.test(data.rubric.version), "Rubric must have a semantic version");
  check(Number.isInteger(data.rubric.reviewWindowDays) && data.rubric.reviewWindowDays > 0, "Invalid review window");
  check(Array.isArray(data.features) && data.features.length > 0, "Catalog must have features");
  const gateIds = new Set();
  for (const gate of data.rubric.gates) {
    check(idPattern.test(gate.id) && !gateIds.has(gate.id), `Invalid or duplicate gate: ${gate.id}`);
    gateIds.add(gate.id);
    check(typeof gate.required === "boolean", `${gate.id}: required must be boolean`);
    for (const field of ["name", "owner", "question", "evidenceRequired", "test"]) {
      check(typeof gate[field] === "string" && gate[field].trim().length > 0, `${gate.id}: missing ${field}`);
    }
  }
  const sourceIds = new Set(Object.keys(data.sources));
  for (const [id, source] of Object.entries(data.sources)) {
    check(isOfficialUrl(source.url, watch.allowedHosts), `${id}: source must use an approved HTTPS host`);
    if (source.provenance?.kind === "automated") machineDate(source, id);
    else validDate(source.verifiedOn, `${id} verifiedOn`);
    check(Boolean(source.title && source.publisher && source.kind), `${id}: missing source metadata`);
  }
  const refs = (ids, label) => {
    check(Array.isArray(ids) && ids.length > 0, `${label}: at least one source required`);
    for (const id of ids ?? []) check(sourceIds.has(id), `${label}: unknown source ${id}`);
  };
  const featureIds = new Set();
  const conciseText = (value, maximum) => typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
  for (const feature of data.features) {
    check(idPattern.test(feature.id) && !featureIds.has(feature.id), `Invalid or duplicate feature: ${feature.id}`);
    featureIds.add(feature.id);
    if (feature.provenance?.kind === "automated") {
      machineDate(feature, feature.id);
      check(feature.readiness.every((gate) => ["unknown", "fail"].includes(gate.status)), `${feature.id}: automated evidence cannot promote readiness`);
      check(feature.demo.liveStatus === "not-run", `${feature.id}: automated kit cannot claim live validation`);
    } else validDate(feature.verifiedOn, `${feature.id} verifiedOn`);
    if (feature.automatedReview) {
      validDate(feature.automatedReview.assessedOn, `${feature.id} automated review`);
      check(feature.automatedReview.kind === "automated" && feature.automatedReview.findings.length === data.rubric.gates.length &&
        new Set(feature.automatedReview.findings.map((gate) => gate.gate)).size === data.rubric.gates.length &&
        feature.automatedReview.findings.every((gate) => gateIds.has(gate.gate) && ["unknown", "fail"].includes(gate.status) && gate.reason && gate.next),
      `${feature.id}: invalid conservative automated review`);
    }
    check(lifecycles.has(feature.lifecycle.status), `${feature.id}: invalid lifecycle`);
    refs([feature.lifecycle.source], `${feature.id} lifecycle`);
    refs(feature.cost.sources, `${feature.id} cost`);
    check(feature.cost.assumptions.length > 0, `${feature.id}: explicit cost assumptions required`);
    check(feature.surfaces.length > 0 && feature.value.length > 0 && feature.limitations.length > 0, `${feature.id}: missing scope/value/limits`);
    for (const step of feature.enablement) refs(step.sources, `${feature.id} enablement`);
    const assessed = new Set();
    for (const assessment of feature.readiness) {
      check(gateIds.has(assessment.gate) && !assessed.has(assessment.gate), `${feature.id}: invalid or duplicate assessment ${assessment.gate}`);
      assessed.add(assessment.gate);
      check(statuses.has(assessment.status), `${feature.id}/${assessment.gate}: invalid finding`);
      check(Boolean(assessment.reason && assessment.next), `${feature.id}/${assessment.gate}: explanation and next action required`);
      refs(assessment.sources, `${feature.id}/${assessment.gate}`);
    }
    for (const gateId of gateIds) check(assessed.has(gateId), `${feature.id}: missing gate ${gateId}`);
    check(feature.demo.status === "kit-tested", `${feature.id}: distinguish kit validation from live validation`);
    check(["not-run", "verified", "blocked"].includes(feature.demo.liveStatus), `${feature.id}: invalid live status`);
    if (feature.demo.liveStatus === "verified") {
      check(Boolean(feature.demo.liveEvidence && feature.demo.liveVerifiedOn), `${feature.id}: live verification requires evidence and date`);
    }
    check(feature.demo.runbook === `demos/${feature.id}/README.md`, `${feature.id}: non-local runbook`);
    check(Boolean(feature.demo.prompt && feature.demo.expected && feature.demo.remoteCleanup), `${feature.id}: incomplete runbook contract`);
  }
  for (const feed of watch.feeds) {
    check(isOfficialUrl(feed.url, watch.allowedHosts), `${feed.id}: feed host not allowed`);
    check(["rss", "releases"].includes(feed.type), `${feed.id}: unsupported feed type`);
    check(Number.isInteger(feed.limit) && feed.limit > 0 && feed.limit <= 100, `${feed.id}: invalid feed limit`);
  }
  check(data.enterpriseUseCases && typeof data.enterpriseUseCases === "object" && !Array.isArray(data.enterpriseUseCases), "Enterprise use cases must be keyed by feature ID");
  for (const id of featureIds) {
    const examples = data.enterpriseUseCases?.[id];
    check(Array.isArray(examples) && examples.length >= 1 && examples.length <= 3 &&
      examples.every((example) => conciseText(example, 80)) &&
      new Set(examples).size === examples.length, `${id}: one to three concise, distinct enterprise use cases required`);
  }
  for (const id of Object.keys(data.enterpriseUseCases ?? {})) check(featureIds.has(id), `Enterprise use cases: unknown feature ${id}`);
  check(data.ga?.schemaVersion === 1 && Array.isArray(data.ga.entries), "Unsupported GA tracker schema");
  validDate(data.ga?.updatedOn, "GA tracker updatedOn");
  check(conciseText(data.ga?.scope, 500), "GA tracker requires an explicit coverage statement");
  const gaIds = new Set();
  const gaSources = new Set();
  for (const entry of Array.isArray(data.ga?.entries) ? data.ga.entries : []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      check(false, "GA tracker: each entry must be an object");
      continue;
    }
    check(idPattern.test(entry.id) && !gaIds.has(entry.id), `Invalid or duplicate GA entry: ${entry.id}`);
    gaIds.add(entry.id);
    check(["feature", "model"].includes(entry.kind), `${entry.id}: distinguish GA features from model availability`);
    validDate(entry.gaOn, `${entry.id} GA date`);
    refs([entry.source], `${entry.id} GA announcement`);
    const source = data.sources[entry.source];
    check(source?.kind === "announcement" && entry.gaOn <= source.verifiedOn && entry.gaOn <= data.ga.updatedOn, `${entry.id}: reviewed primary GA announcement required`);
    check(!gaSources.has(entry.source), `${entry.id}: duplicate GA announcement`);
    gaSources.add(entry.source);
    for (const field of ["name", "summary", "enterpriseUse", "scopeNote"]) {
      check(conciseText(entry[field], field === "name" ? 80 : 240), `${entry.id}: missing or oversized ${field}`);
    }
  }
  for (const item of data.monitor.items) {
    check(isOfficialUrl(item.url, watch.allowedHosts), `Monitor: untrusted URL ${item.url}`);
    check(["preview-signal", "lifecycle-signal", "release", "update"].includes(item.signal), `Monitor: unknown signal ${item.signal}`);
    check(!Object.hasOwn(item, "gaSignal") || typeof item.gaSignal === "boolean", "Monitor: gaSignal must be boolean");
  }
  if (errors.length) throw new Error(`Catalog validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

export async function validateFiles(data, artifacts = false) {
  for (const feature of data.features) await access(fromRoot(feature.demo.runbook));
  if (!artifacts) return;
  const manifest = await readJson(fromRoot("artifacts", "manifest.json"));
  for (const feature of data.features) {
    const artifact = manifest.features.find((item) => item.id === feature.id);
    if (!artifact || artifact.fingerprint !== fingerprint(feature, data)) {
      throw new Error(`${feature.id}: artifact content is stale; run npm run artifacts`);
    }
    await access(fromRoot(artifact.deck));
    const assessment = await readFile(fromRoot(artifact.assessment), "utf8");
    if (assessment !== assessmentMarkdown(feature, data)) throw new Error(`${feature.id}: generated assessment is stale`);
  }
  await access(fromRoot("artifacts", "slides", "copilot-runway.pptx"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const data = await loadCatalog();
    validateCatalog(data, await readJson(fromRoot("catalog", "watch.json")));
    await validateFiles(data, process.argv.includes("--artifacts"));
    console.log(`Validated ${data.features.length} features, ${data.rubric.gates.length} non-negotiable gates, and official-source references.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
