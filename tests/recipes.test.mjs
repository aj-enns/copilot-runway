import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { fromRoot, assessmentMarkdown, mdText, mdFence, mdUrl } from "../scripts/lib.mjs";
import { setupDemo, verifyDemo, rehearseDemo } from "../scripts/demo.mjs";
import { fixtures } from "../demos/fixtures.mjs";
import { recipeFixtures, recipeRunbook, assertRecipeFeature } from "../demos/recipes.mjs";
import { validateRecipe, runRecipe, rehearsalScenario, verdict, freshness, reviewLabel } from "../site/model.mjs";
import { featureVisual } from "../site/feature-visuals.mjs";

const input = { operation: "classify-required-booleans", requiredFields: ["audit", "sso"], records: [
  { id: "alpha-app", audit: true, sso: true }, { id: "beta-app", audit: false, sso: true }] };
const recipe = () => {
  const value = {
    schemaVersion: 1, files: { "input.json": JSON.stringify(input) }, output: "result.json", expected: null,
    steps: [{ title: "Inspect", detail: "Review the synthetic records first." }],
    controlStory: ["Read records", "Classify required fields", "Human reviews result"],
  };
  value.expected = runRecipe({ ...value, expected: runRecipeExpected() });
  return value;
};
function runRecipeExpected() {
  return { schemaVersion: 1, operation: input.operation, classification: "synthetic", summary: { total: 2, passed: 1, blocked: 1 },
    results: [{ id: "alpha-app", decision: "pass", missing: [] }, { id: "beta-app", decision: "blocked", missing: ["audit"] }] };
}
const feature = () => ({
  id: "synthetic-kit", name: "Synthetic kit", icon: "check", lifecycle: { status: "public-preview", source: "s", note: "n" },
  verifiedOn: null, provenance: { kind: "automated", assessedOn: "2026-10-18" }, readiness: [],
  demo: { title: "Check records", minutes: 5, mode: "Local", status: "kit-tested", liveStatus: "not-run", runbook: "demos/synthetic-kit/README.md",
    prompt: "Classify input.json into result.json.", expected: "Exact classification.", remoteCleanup: "None.", recipe: recipe() },
});

async function isolated(context) {
  await mkdir(fromRoot("qa-results"), { recursive: true });
  const root = await mkdtemp(fromRoot("qa-results", "unit-recipe-"));
  context.after(async () => {
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) await unlink(join(entry.parentPath, entry.name));
    }
    for (const entry of (await readdir(root, { recursive: true, withFileTypes: true })).filter((e) => e.isDirectory()).reverse()) await rmdir(join(entry.parentPath, entry.name));
    await rmdir(root);
  });
  return root;
}

test("recipe validation accepts the exact schema and rejects unsafe or unsupported data", () => {
  assert.doesNotThrow(() => validateRecipe(recipe()));
  const bad = (mutate, pattern) => { const value = recipe(); mutate(value); assert.throws(() => validateRecipe(value), pattern); };
  bad((v) => { v.extra = 1; }, /exactly/);
  bad((v) => { v.files["run.sh"] = "x"; }, /exactly/);
  bad((v) => { v.output = "../x.json"; }, /output/);
  bad((v) => { v.output = "offline-result.json"; }, /output/);
  bad((v) => { v.expected.summary.passed = 2; }, /does not match/);
  bad((v) => { v.steps[0].detail = "<script>alert(1)</script>"; }, /plain text/);
  bad((v) => { v.steps[0].title = "`x`"; }, /plain text/);
  bad((v) => { v.controlStory = ["a", "b"]; }, /exactly three/);
  bad((v) => { v.files["input.json"] = JSON.stringify({ ...input, operation: "shell" }); }, /Unsupported recipe operation/);
  bad((v) => { v.files["input.json"] = JSON.stringify({ ...input, records: [{ id: "a", audit: 1, sso: true }] }); }, /boolean/);
  bad((v) => { v.files["input.json"] = JSON.stringify({ ...input, records: [{ id: "a", audit: true, sso: true, cmd: "x" }] }); }, /exactly/);
});

test("recipe fixtures cannot replace bespoke kits and drive offline setup, rehearse, verify, and reset", async (context) => {
  assert.throws(() => recipeFixtures([{ ...feature(), id: "autopilot", demo: { ...feature().demo, runbook: "demos/autopilot/README.md" } }], fixtures), /duplicate/);
  assert.throws(() => recipeFixtures([{ ...feature(), demo: { ...feature().demo, liveStatus: "verified" } }]), /live validation/);
  const registry = recipeFixtures([feature()]);
  const root = await isolated(context);
  const directory = await setupDemo("synthetic-kit", root, false, registry);
  assert.equal(await readFile(join(directory, "input.json"), "utf8"), recipe().files["input.json"]);
  const offline = await rehearseDemo("synthetic-kit", root, registry);
  assert.equal(offline.mode, "offline-rehearsal");
  assert.equal(offline.liveStatus, "not-run");
  await assert.rejects(verifyDemo("synthetic-kit", root, registry), /live-demo result.*absent/);
  await writeFile(join(directory, "result.json"), JSON.stringify({ ...runRecipeExpected(), summary: { total: 2, passed: 2, blocked: 0 } }));
  await assert.rejects(verifyDemo("synthetic-kit", root, registry), /deterministic/);
  await writeFile(join(directory, "result.json"), JSON.stringify(runRecipeExpected()));
  await assert.doesNotReject(verifyDemo("synthetic-kit", root, registry));
  await setupDemo("synthetic-kit", root, true, registry);
  assert.deepEqual((await readdir(directory)).sort(), [".runway-demo.json", "input.json"]);
});

test("recipe features render safe runbooks, visuals, scenarios, and held automated readiness", () => {
  const item = feature();
  const sources = { s: { url: "https://docs.github.com/en/copilot", title: "S", verifiedOn: null } };
  item.lifecycle.source = "s";
  item.cost = { sources: [] }; item.enablement = [];
  assertRecipeFeature(item);
  const runbook = recipeRunbook({ ...item, demo: { ...item.demo, prompt: "```\n<img src=x onerror=alert(1)>" } }, sources);
  assert.match(runbook, /````text\n```\n<img src=x onerror=alert\(1\)>\n````/);
  assert.match(runbook, /liveStatus|live feature validation: not-run/);
  const visual = featureVisual(item, { check: '<svg viewBox="0 0 16 16"><path d="M1 1"/></svg>', alert: '<svg viewBox="0 0 16 16"><path d="M1 1"/></svg>' });
  assert.match(visual.svg, /beta-app/);
  assert.doesNotMatch(visual.svg, /<script/);
  const scenario = rehearsalScenario("synthetic-kit", item);
  assert.match(scenario.after, /beta-app {2}blocked: missing audit/);
  assert.throws(() => rehearsalScenario("synthetic-kit"), /No rehearsal scenario/);
  const rubric = { reviewWindowDays: 60, gates: [] };
  assert.equal(verdict(item, rubric, new Date("2026-10-18T12:00:00Z"), sources), "blocked");
  assert.equal(verdict({ ...item, provenance: undefined, verifiedOn: "2026-10-18", automatedReview: {} }, rubric, new Date("2026-10-18T12:00:00Z"), { s: { verifiedOn: "2026-10-18" } }), "blocked");
  assert.deepEqual(freshness(null, 60), { age: null, stale: true });
  assert.equal(reviewLabel(item), "Not human verified (assessed 2026-10-18)");
});

test("assessment markdown tolerates null human dates without fabricating them", () => {
  const item = feature();
  const data = { rubric: { version: "t", reviewWindowDays: 60, gates: [] }, sources: { s: { url: "https://docs.github.com/x", title: "S", verifiedOn: null } } };
  Object.assign(item, { summary: "x", cost: { sources: [], headline: "h", detail: "d", assumptions: [] }, enablement: [], value: [], limitations: [] });
  item.lifecycle.source = "s";
  const markdown = assessmentMarkdown(item, data);
  assert.match(markdown, /Not human verified/);
  assert.match(markdown, /\(not human verified\)/);
  assert.doesNotMatch(markdown, /null|undefined/);
});

test("generated markdown neutralizes hostile source and feature strings but keeps curated commands", () => {
  const item = feature();
  const evil = "x <img src=x onerror=1>\n# Injected [link](javascript:alert(1)) `tick` https://evil.example/a";
  const data = { rubric: { version: "t", reviewWindowDays: 60, gates: [{ id: "g", name: "Gate", required: true }] },
    sources: { s: { url: "https://docs.github.com/a(b)", title: "T](https://evil.example) <b>", verifiedOn: null } } };
  Object.assign(item, { name: evil, summary: evil, cost: { sources: [], headline: evil, detail: evil, assumptions: [evil] },
    enablement: [{ title: evil, detail: evil, sources: [], command: "copilot --x\n```\n<b>raw</b>" }],
    value: [evil], limitations: [evil], readiness: [{ gate: "g", status: "unknown", reason: evil, next: evil, sources: ["s"] }] });
  item.lifecycle = { status: "public-preview", source: "s", note: evil };
  item.demo.expected = evil; item.demo.remoteCleanup = evil;
  const markdown = assessmentMarkdown(item, data);
  const outside = markdown.replace(/(`{4,})text\n[\s\S]*?\n\1/g, "");
  assert.doesNotMatch(outside, /<img|<b>|\n# Injected|(?<!\\)\]\(javascript:|https:\/\/evil|(?<!\\)`tick/);
  assert.match(markdown, /````text\ncopilot --x\n```\n<b>raw<\/b>\n````/);
  assert.match(markdown, /\(https:\/\/docs\.github\.com\/a%28b%29\)/);
});

test("markdown helpers reject unsafe links and collapse structure", () => {
  assert.equal(mdText("a\r\nb"), "a b");
  assert.throws(() => mdUrl("http://docs.github.com/x"), /HTTPS/);
  assert.throws(() => mdUrl("javascript:alert(1)"));
  assert.throws(() => mdUrl("https://user:pw@docs.github.com/x"), /credentialed/);
  assert.equal(mdFence("a"), "```text\na\n```");
});

test("invalid recipes throw from the public validator and interpreter", () => {
  const broken = recipe();
  broken.files["input.json"] = "{not json";
  assert.throws(() => validateRecipe(broken), /not valid JSON/);
  assert.throws(() => runRecipe(broken), /not valid JSON/);
  assert.throws(() => validateRecipe(null), /exactly/);
  assert.throws(() => validateRecipe([]), /exactly/);
});