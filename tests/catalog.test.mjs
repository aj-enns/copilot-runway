import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalog, fromRoot, readJson, isOfficialUrl, isDate, assessmentMarkdown } from "../scripts/lib.mjs";
import { validateCatalog } from "../scripts/validate.mjs";
import { freshness, verdict, filterFeatures, calculateCost, validateWorkshop, policyExport, rehearsalScenario } from "../site/model.mjs";

const data = await loadCatalog();
const watch = await readJson(fromRoot("catalog", "watch.json"));
const current = new Date("2026-10-14T12:00:00Z");
const copy = () => structuredClone(data);

test("six fully assessed capabilities use ten explicit required gates", () => {
  assert.doesNotThrow(() => validateCatalog(data, watch, "2026-10-14"));
  assert.equal(data.features.length, 6);
  assert.equal(data.rubric.gates.length, 10);
  assert.ok(data.rubric.gates.every((gate) => gate.required));
  assert.ok(data.features.every((feature) => feature.demo.liveStatus === "not-run"));
  assert.equal(data.features.filter((feature) => feature.lifecycle.status === "public-preview").length, 3);
});

test("experimental SDK and technical-preview Actions are not conflated", () => {
  assert.equal(data.features.find((feature) => feature.id === "dynamic-workflows").lifecycle.status, "experimental");
  assert.equal(data.features.find((feature) => feature.id === "agentic-workflows").lifecycle.status, "technical-preview");
});

test("required unknown, fail, missing, or stale findings cannot be averaged away", () => {
  const feature = structuredClone(data.features[0]);
  assert.equal(verdict(feature, data.rubric, current, data.sources), "conditional");
  feature.readiness[0].status = "unknown";
  assert.equal(verdict(feature, data.rubric, current, data.sources), "blocked");
  feature.readiness[0].status = "fail";
  assert.equal(verdict(feature, data.rubric, current, data.sources), "blocked");
  feature.readiness.shift();
  assert.equal(verdict(feature, data.rubric, current, data.sources), "blocked");
  assert.equal(verdict(data.features[0], data.rubric, new Date("2026-11-15T12:00:00Z"), data.sources), "blocked");
});

test("an all-pass decision still requires complete current official references", () => {
  const feature = structuredClone(data.features[0]);
  feature.readiness.forEach((gate) => { gate.status = "pass"; });
  assert.equal(verdict(feature, data.rubric, current, data.sources), "ready");
  const missing = structuredClone(data.sources);
  delete missing.computer;
  assert.equal(verdict(feature, data.rubric, current, missing), "blocked");
  const stale = structuredClone(data.sources);
  stale.billing.verifiedOn = "2026-09-01";
  assert.equal(verdict(feature, data.rubric, current, stale), "blocked");
});

test("staleness uses the declared 30-day boundary and rejects future evidence", () => {
  assert.equal(freshness("2026-10-14", 30, new Date("2026-11-13T12:00:00Z")).stale, false);
  assert.equal(freshness("2026-10-14", 30, new Date("2026-11-14T00:00:00Z")).stale, true);
  assert.equal(freshness("2026-10-15", 30, current).stale, true);
  assert.equal(freshness("invalid", 30, current).stale, true);
  assert.equal(isDate("2026-02-30"), false);
});

test("invalid sources, duplicate or missing gates, and unsupported lifecycle fail validation", () => {
  const badSource = copy();
  badSource.sources.computer.url = "https://docs.github.com.attacker.invalid/feature";
  assert.throws(() => validateCatalog(badSource, watch, "2026-10-14"), /approved HTTPS host/);
  const missingGate = copy();
  missingGate.features[0].readiness.pop();
  assert.throws(() => validateCatalog(missingGate, watch, "2026-10-14"), /missing gate/);
  const duplicate = copy();
  duplicate.features[0].readiness.push(duplicate.features[0].readiness[0]);
  assert.throws(() => validateCatalog(duplicate, watch, "2026-10-14"), /duplicate assessment/);
  const unknownStage = copy();
  unknownStage.features[0].lifecycle.status = "customer-ready";
  assert.throws(() => validateCatalog(unknownStage, watch, "2026-10-14"), /invalid lifecycle/);
});

test("unapproved schemes, credentials, ports, and host suffixes are rejected", () => {
  for (const url of ["http://github.com/x", "https://github.com.evil.invalid/x", "https://user:secret@github.com/x", "https://github.com:8443/x", "javascript:alert(1)", "data:text/html,hello"]) {
    assert.equal(isOfficialUrl(url, watch.allowedHosts), false);
  }
  assert.equal(isOfficialUrl("https://docs.github.com/en/copilot", watch.allowedHosts), true);
});

test("feature filters compose text, stage, readiness, and surface", () => {
  const filtered = filterFeatures(data.features, { search: "desktop GUI", lifecycle: "public-preview", surface: "Windows" }, data.rubric, data.sources, current);
  assert.deepEqual(filtered.map((feature) => feature.id), ["computer-use"]);
  const held = filterFeatures(data.features, { readiness: "blocked" }, data.rubric, data.sources, current);
  assert.deepEqual(held.map((feature) => feature.id), ["dynamic-workflows"]);
  assert.equal(filterFeatures(data.features, { search: "does-not-exist" }, data.rubric, data.sources, current).length, 0);
});

test("cost lab verifies exact published meter arithmetic and explicit zero", () => {
  const hour = calculateCost({ credits: 0, minutes: 60, memoryGiB: 4, snapshotGiB: 0, months: 0 });
  assert.ok(Math.abs(hour.total - .1296) < 1e-12);
  const scenario = calculateCost({ credits: 100, minutes: 30, memoryGiB: 4, snapshotGiB: 1, months: 1 });
  assert.ok(Math.abs(scenario.total - 1.0698) < 1e-12);
  assert.equal(calculateCost({ credits: 0, minutes: 0, memoryGiB: 0, snapshotGiB: 0, months: 0 }).total, 0);
  for (const invalid of [-1, Infinity, NaN, "100", 1_000_001]) {
    assert.throws(() => calculateCost({ credits: invalid, minutes: 0, memoryGiB: 0, snapshotGiB: 0, months: 0 }), /finite number/);
  }
});

test("workshop additions export as unadopted proposals and never mutate canonical gates", () => {
  const local = { schemaVersion: 1, rules: [{ id: "local-extra", name: "Approved log retention" }] };
  const result = policyExport(data.rubric, local);
  assert.equal(result.classification, "proposed-workshop-policy");
  assert.equal(result.gates.length, 11);
  assert.equal(data.rubric.gates.length, 10);
  assert.equal(result.gates.at(-1).owner, "REQUIRES OWNER");
  assert.throws(() => validateWorkshop({ schemaVersion: 2, rules: [] }), /unsupported shape/);
  assert.throws(() => validateWorkshop({ schemaVersion: 1, rules: [{ id: "../escape", name: "Bad rule" }] }), /invalid/);
});

test("all browser rehearsals are available and remain explicitly synthetic", () => {
  for (const feature of data.features) {
    const scenario = rehearsalScenario(feature.id);
    assert.ok(scenario.before && scenario.after && scenario.review && scenario.proof);
  }
  assert.throws(() => rehearsalScenario("unknown"), /No rehearsal/);
  assert.match(rehearsalScenario("cloud-sandboxes").after, /local-rehearsal/);
  assert.match(rehearsalScenario("copilot-memory").after, /memory: none/);
});

test("generated Markdown exposes all gates, cost assumptions, reset, live status, and evidence", () => {
  for (const feature of data.features) {
    const markdown = assessmentMarkdown(feature, data);
    assert.match(markdown, /not a production certification/);
    assert.match(markdown, /Live feature validation: not-run/);
    assert.match(markdown, /Separate remote cleanup/);
    for (const gate of data.rubric.gates) assert.ok(markdown.includes(gate.name));
    assert.ok(markdown.includes(data.sources[feature.lifecycle.source].url));
  }
});
