import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalog, fromRoot, readJson, isOfficialUrl, isDate, fingerprint, assessmentMarkdown } from "../scripts/lib.mjs";
import { validateCatalog } from "../scripts/validate.mjs";
import { freshness, verdict, filterFeatures, filterGaEntries, gaCandidates, calculateCost, validateWorkshop, policyExport, rehearsalScenario } from "../site/model.mjs";

const data = await loadCatalog();
const watch = await readJson(fromRoot("catalog", "watch.json"));
const current = new Date("2026-10-14T12:00:00Z");
const copy = () => structuredClone(data);

test("curated and automated capabilities use ten explicit required gates", () => {
  assert.doesNotThrow(() => validateCatalog(data, watch));
  for (const id of ["computer-use", "dynamic-workflows", "agentic-workflows", "cloud-sandboxes", "copilot-memory", "autopilot"]) {
    assert.ok(data.features.some((feature) => feature.id === id));
  }
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
  delete feature.automatedReview;
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
  delete feature.automatedReview;
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
  assert.deepEqual(held.map((feature) => feature.id), data.features.filter((feature) => verdict(feature, data.rubric, current, data.sources) === "blocked").map((feature) => feature.id));
  assert.equal(filterFeatures(data.features, { search: "does-not-exist" }, data.rubric, data.sources, current).length, 0);
});

test("every feature has concise enterprise examples and their text is searchable", () => {
  assert.deepEqual(Object.keys(data.enterpriseUseCases).sort(), data.features.map((feature) => feature.id).sort());
  for (const feature of data.features) {
    assert.ok(data.enterpriseUseCases[feature.id].length >= 1 && data.enterpriseUseCases[feature.id].length <= 3);
    assert.ok(data.enterpriseUseCases[feature.id].every((example) => example.length <= 80));
  }
  const filtered = filterFeatures(data.features, { search: "legacy support records", lifecycle: "public-preview" },
    data.rubric, data.sources, current, data.enterpriseUseCases);
  assert.deepEqual(filtered.map((feature) => feature.id), ["computer-use"]);
  for (const examples of [undefined, [], [" "], ["x".repeat(81)], ["duplicate", "duplicate"]]) {
    const invalid = copy();
    invalid.enterpriseUseCases["computer-use"] = examples;
    assert.throws(() => validateCatalog(invalid, watch, "2026-10-14"), /concise, distinct enterprise use cases/);
  }
  const unknown = copy();
  unknown.enterpriseUseCases["unknown-feature"] = ["Unassessed suggestion"];
  assert.throws(() => validateCatalog(unknown, watch, "2026-10-14"), /unknown feature/);
});

test("GA records require valid dates, primary sources, scope, and feature/model distinctions", () => {
  assert.equal(data.ga.entries.length, 3);
  assert.equal(data.ga.entries.filter((entry) => entry.kind === "feature").length, 1);
  assert.equal(data.ga.entries.filter((entry) => entry.kind === "model").length, 2);
  for (const [field, value, message] of [
    ["gaOn", "2026-10-15", /invalid or future date/],
    ["gaOn", "2026-02-30", /invalid or future date/],
    ["source", "unknown-source", /unknown source/],
    ["source", "billing", /primary GA announcement/],
    ["scopeNote", "", /missing or oversized scopeNote/],
    ["kind", "preview", /distinguish GA features/],
  ]) {
    const invalid = copy();
    invalid.ga.entries[0][field] = value;
    assert.throws(() => validateCatalog(invalid, watch, "2026-10-14"), message);
  }
  const unreviewed = copy();
  unreviewed.sources[unreviewed.ga.entries[0].source].verifiedOn = "2026-10-12";
  assert.throws(() => validateCatalog(unreviewed, watch, "2026-10-14"), /primary GA announcement/);
  const duplicate = copy();
  duplicate.ga.entries.push(structuredClone(duplicate.ga.entries[0]));
  assert.throws(() => validateCatalog(duplicate, watch, "2026-10-14"), /duplicate GA/);
  for (const entries of [{}, [null]]) {
    const malformed = copy();
    malformed.ga.entries = entries;
    assert.throws(() => validateCatalog(malformed, watch, "2026-10-14"), /GA tracker/);
  }
});

test("GA filters sort newest-first, enforce time boundaries, and retain all-history access", () => {
  assert.deepEqual(filterGaEntries(data.ga.entries, {}, current).map((entry) => entry.id),
    ["gemini-4-argon", "claude-haiku-5-5", "local-sandboxing"]);
  assert.deepEqual(filterGaEntries(data.ga.entries, { kind: "feature" }, current).map((entry) => entry.id), ["local-sandboxing"]);
  assert.equal(filterGaEntries(data.ga.entries, { kind: "model" }, current).length, 2);
  assert.equal(filterGaEntries(data.ga.entries, { windowDays: 30 }, new Date("2026-11-20T12:00:00Z")).length, 0);
  assert.equal(filterGaEntries(data.ga.entries, { windowDays: 0 }, new Date("2027-03-01T12:00:00Z")).length, 3);
  const boundary = [{ id: "boundary", name: "Boundary", kind: "feature", gaOn: "2026-07-16" }];
  assert.equal(filterGaEntries(boundary, {}, current).length, 1);
  assert.equal(filterGaEntries(boundary, {}, new Date("2026-10-15T12:00:00Z")).length, 0);
  assert.equal(filterGaEntries([{ ...boundary[0], gaOn: "2026-10-15" }], { windowDays: 0 }, current).length, 0);
  assert.equal(filterGaEntries([{ ...boundary[0], gaOn: "invalid" }], { windowDays: 0 }, current).length, 0);
  assert.throws(() => filterGaEntries(data.ga.entries, { windowDays: -1 }), /Unsupported GA tracker filter/);
  assert.throws(() => filterGaEntries(data.ga.entries, { kind: "preview" }), /Unsupported GA tracker filter/);
});

test("pending GA signals exclude reviewed URL aliases, retirement signals, and stable releases", () => {
  const base = { id: "pending", feed: "copilot-changelog", title: "New GA signal", signal: "lifecycle-signal",
    gaSignal: true, url: "https://github.blog/changelog/new-ga/", publishedOn: "2026-10-14T12:00:00Z" };
  const items = [
    { ...base, id: "known", url: data.sources["local-sandbox-ga"].url + "?utm_source=feed#details" },
    base,
    { ...base, id: "duplicate", url: base.url.replace(/\/$/, "") + "#section" },
    { ...base, id: "retired", url: "https://github.blog/changelog/retired/", gaSignal: false },
    { ...base, id: "cli-release", url: "https://github.com/github/copilot-cli/releases/tag/v1", feed: "copilot-cli-releases" },
    { ...base, id: "legacy-snapshot", url: "https://github.blog/changelog/old-signal/", gaSignal: undefined },
  ];
  assert.deepEqual(gaCandidates(items, data.ga.entries, data.sources).map((item) => item.id), ["pending"]);
});

test("portal recommendations and GA history cannot mutate feature evidence or invalidate existing briefs", () => {
  const snapshot = JSON.stringify(data.features);
  const changed = copy();
  changed.enterpriseUseCases["computer-use"] = ["Another illustrative enterprise scenario"];
  changed.ga.entries = [];
  for (const feature of data.features) {
    assert.equal(fingerprint(feature, changed), fingerprint(feature, data));
    assert.equal(assessmentMarkdown(feature, changed), assessmentMarkdown(feature, data));
    assert.equal(verdict(feature, changed.rubric, current, changed.sources), verdict(feature, data.rubric, current, data.sources));
  }
  filterGaEntries(data.ga.entries, {}, current);
  gaCandidates(data.monitor.items, data.ga.entries, data.sources);
  assert.equal(JSON.stringify(data.features), snapshot);
  assert.equal(data.features.find((feature) => feature.id === "cloud-sandboxes").lifecycle.status, "public-preview");
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
