export const lifecycleLabels = {
  "public-preview": "Public preview",
  "technical-preview": "Technical preview",
  experimental: "Experimental",
  ga: "Generally available",
  retired: "Retired",
  unverified: "Unverified",
};

export const verdictLabels = {
  blocked: "Hold for evidence",
  conditional: "Pilot with conditions",
  ready: "Pilot gates satisfied",
};

export function isAutomated(feature) {
  return feature?.provenance?.kind === "automated";
}

export function reviewLabel(feature) {
  if (feature.verifiedOn) return `Reviewed ${feature.verifiedOn}`;
  return feature.provenance?.assessedOn ? `Not human verified (assessed ${feature.provenance.assessedOn})` : "Not human verified";
}

export function evaluationDate(feature) {
  const day = feature.verifiedOn ?? feature.provenance?.assessedOn;
  if (typeof day !== "string") throw new Error(`${feature.id}: no verification or assessment date`);
  return new Date(`${day}T12:00:00Z`);
}

export function freshness(verifiedOn, windowDays, now = new Date()) {
  if (verifiedOn === null || verifiedOn === undefined) return { age: null, stale: true };
  const age = Math.floor((now.valueOf() - new Date(`${verifiedOn}T00:00:00Z`).valueOf()) / 86_400_000);
  return { age, stale: !Number.isFinite(age) || age < 0 || age > windowDays };
}

export function featureSourceIds(feature) {
  return [...new Set([
    feature.lifecycle.source,
    ...feature.cost.sources,
    ...feature.enablement.flatMap((step) => step.sources),
    ...feature.readiness.flatMap((assessment) => assessment.sources),
  ])];
}

export function evidenceIsStale(feature, rubric, sources, now = new Date()) {
  return freshness(feature.verifiedOn, rubric.reviewWindowDays, now).stale ||
    featureSourceIds(feature).some((id) => !sources[id] ||
      freshness(sources[id].verifiedOn, rubric.reviewWindowDays, now).stale);
}

export function verdict(feature, rubric, now = new Date(), sources = {}) {
  const statuses = rubric.gates.filter((gate) => gate.required).map((gate) =>
    feature.readiness.find((assessment) => assessment.gate === gate.id)?.status ?? "unknown");
  const stale = evidenceIsStale(feature, rubric, sources, now);
  if (stale || feature.automatedReview !== undefined || isAutomated(feature) || statuses.some((status) => status === "fail" || status === "unknown")) return "blocked";
  if (statuses.some((status) => status === "conditional")) return "conditional";
  return "ready";
}

export function filterFeatures(features, filters, rubric, sources, now = new Date(), enterpriseUseCases = {}) {
  const search = (filters.search ?? "").trim().toLowerCase();
  const words = search.split(/\s+/).filter(Boolean);
  return features.filter((feature) => {
    const haystack = [feature.id, feature.name, feature.summary, feature.category, ...feature.tags, ...feature.surfaces,
      ...(enterpriseUseCases[feature.id] ?? [])].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word)) &&
      (!filters.lifecycle || feature.lifecycle.status === filters.lifecycle) &&
      (!filters.readiness || verdict(feature, rubric, now, sources) === filters.readiness) &&
      (!filters.surface || feature.surfaces.includes(filters.surface));
  });
}

export function filterGaEntries(entries, { windowDays = 90, kind = "" } = {}, now = new Date()) {
  if (![0, 30, 90].includes(windowDays) || !["", "feature", "model"].includes(kind)) throw new Error("Unsupported GA tracker filter");
  return entries.filter((entry) => {
    const state = freshness(entry.gaOn, windowDays, now);
    return Number.isFinite(state.age) && state.age >= 0 && (!windowDays || !state.stale) && (!kind || entry.kind === kind);
  }).sort((a, b) => b.gaOn.localeCompare(a.gaOn) || a.name.localeCompare(b.name));
}

export function gaCandidates(items, entries, sources) {
  const canonical = (value) => {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "");
  };
  const reviewed = new Set(entries.map((entry) => canonical(sources[entry.source].url)));
  const candidates = new Map();
  for (const item of items) {
    if (item.feed !== "copilot-changelog" || item.gaSignal !== true) continue;
    const url = canonical(item.url);
    if (!reviewed.has(url) && !candidates.has(url)) candidates.set(url, item);
  }
  return [...candidates.values()].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || a.id.localeCompare(b.id));
}

export const costRates = {
  aiCredit: 0.01,
  computeSecond: 0.000024,
  memoryGiBSecond: 0.000003,
  snapshotGiBMonth: 0.005,
};

export function calculateCost({ credits, minutes, memoryGiB, snapshotGiB, months }) {
  const values = { credits, minutes, memoryGiB, snapshotGiB, months };
  for (const [name, value] of Object.entries(values)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
      throw new Error(`${name} must be a finite number between 0 and 1,000,000`);
    }
  }
  const seconds = minutes * 60;
  const ai = credits * costRates.aiCredit;
  const compute = seconds * costRates.computeSecond;
  const memory = seconds * memoryGiB * costRates.memoryGiBSecond;
  const storage = snapshotGiB * months * costRates.snapshotGiBMonth;
  return { ai, compute, memory, storage, total: ai + compute + memory + storage };
}

export function validateWorkshop(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.rules) || value.rules.length > 25) {
    throw new Error("Saved workshop rules have an unsupported shape");
  }
  const rules = value.rules.map((rule) => {
    if (!rule || typeof rule.id !== "string" || !/^local-[a-z0-9-]+$/.test(rule.id) ||
      typeof rule.name !== "string" || rule.name.trim().length < 3 || rule.name.length > 160) {
      throw new Error("Saved workshop rule is invalid");
    }
    return { id: rule.id, name: rule.name.trim(), required: true, scope: "local-workshop" };
  });
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) throw new Error("Duplicate workshop rule IDs");
  return { schemaVersion: 1, rules };
}

export function policyExport(rubric, workshop) {
  const valid = validateWorkshop(workshop);
  return {
    schemaVersion: 1,
    baseVersion: rubric.version,
    classification: "proposed-workshop-policy",
    notice: "Local additions are not adopted policy or verified feature assessments. Submit a reviewed repository change for durable adoption.",
    gates: [
      ...rubric.gates,
      ...valid.rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        required: true,
        owner: "REQUIRES OWNER",
        question: rule.name,
        evidenceRequired: "REQUIRES DEFINITION",
        test: "REQUIRES ACCEPTANCE TEST",
      })),
    ],
  };
}


export const recipeOperation = "classify-required-booleans";
const plainText = /^[A-Za-z0-9][A-Za-z0-9 .,:;'"()\/+%#=?-]*$/;

function exactKeys(value, keys, label) {
  const prototype = value && typeof value === "object" ? Object.getPrototypeOf(value) : undefined;
  if (!value || Array.isArray(value) || (prototype !== Object.prototype && prototype !== null) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Error(`Recipe ${label} must contain exactly: ${keys.join(", ")}`);
}

function safeText(value, max, label) {
  if (typeof value !== "string" || value.length > max || !plainText.test(value) || value !== value.trim()) {
    throw new Error(`Recipe ${label} must be plain text of at most ${max} characters`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export const sameRecipeOutput = (a, b) => canonical(a) === canonical(b);

export function parseRecipeInput(text) {
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("Recipe input.json is not valid JSON");
  }
  exactKeys(input, ["operation", "requiredFields", "records"], "input");
  if (input.operation !== recipeOperation) throw new Error(`Unsupported recipe operation; only ${recipeOperation} is supported`);
  const fields = input.requiredFields;
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > 5 || new Set(fields).size !== fields.length ||
    fields.some((field) => typeof field !== "string" || !/^[a-z][A-Za-z0-9]{0,30}$/.test(field))) {
    throw new Error("Recipe requiredFields must be 1-5 unique camelCase names");
  }
  if (!Array.isArray(input.records) || input.records.length < 1 || input.records.length > 10) throw new Error("Recipe records must contain 1-10 items");
  for (const record of input.records) {
    exactKeys(record, ["id", ...fields], "record");
    if (typeof record.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(record.id) || fields.some((field) => typeof record[field] !== "boolean")) {
      throw new Error("Recipe records need a lowercase id and boolean required fields");
    }
  }
  if (new Set(input.records.map((record) => record.id)).size !== input.records.length) throw new Error("Recipe record IDs must be unique");
  return input;
}

function classify(input) {
  const results = input.records.map((record) => {
    const missing = input.requiredFields.filter((field) => record[field] !== true);
    return { id: record.id, decision: missing.length ? "blocked" : "pass", missing };
  });
  const blocked = results.filter((result) => result.decision === "blocked").length;
  return {
    schemaVersion: 1, operation: recipeOperation, classification: "synthetic",
    summary: { total: results.length, passed: results.length - blocked, blocked }, results,
  };
}

export function validateRecipe(recipe) {
  exactKeys(recipe, ["schemaVersion", "files", "output", "expected", "steps", "controlStory"], "recipe");
  if (recipe.schemaVersion !== 1) throw new Error("Unsupported recipe schemaVersion");
  exactKeys(recipe.files, ["input.json"], "files");
  if (typeof recipe.files["input.json"] !== "string" || recipe.files["input.json"].length > 4096) throw new Error("Recipe input.json must be a string of at most 4096 characters");
  if (typeof recipe.output !== "string" || !/^[a-z][a-z0-9-]{0,39}\.json$/.test(recipe.output) || recipe.output.startsWith("offline-")) {
    throw new Error("Recipe output must be a simple lowercase .json name");
  }
  const computed = classify(parseRecipeInput(recipe.files["input.json"]));
  if (!sameRecipeOutput(recipe.expected, computed)) throw new Error("Recipe expected output does not match the deterministic operation result");
  if (!Array.isArray(recipe.steps) || recipe.steps.length < 1 || recipe.steps.length > 6) throw new Error("Recipe steps must contain 1-6 items");
  recipe.steps.forEach((step, index) => {
    exactKeys(step, ["title", "detail"], `step ${index + 1}`);
    safeText(step.title, 60, `step ${index + 1} title`);
    safeText(step.detail, 240, `step ${index + 1} detail`);
  });
  if (!Array.isArray(recipe.controlStory) || recipe.controlStory.length !== 3) throw new Error("Recipe controlStory must contain exactly three items");
  recipe.controlStory.forEach((item, index) => safeText(item, 60, `controlStory ${index + 1}`));
  return recipe;
}

export function runRecipe(recipe) {
  return classify(parseRecipeInput(validateRecipe(recipe).files["input.json"]));
}

function recipeScenario(feature) {
  const recipe = validateRecipe(feature.demo.recipe);
  const input = parseRecipeInput(recipe.files["input.json"]);
  const output = runRecipe(recipe);
  const mark = (value) => (value ? "yes" : "NO");
  return {
    title: feature.demo.title,
    before: input.records.map((record) => `${record.id}  ${input.requiredFields.map((field) => `${field} ${mark(record[field])}`).join(" | ")}`).join("\n"),
    after: `${output.results.map((result) => `${result.id}  ${result.decision}${result.missing.length ? `: missing ${result.missing.join(", ")}` : ""}`).join("\n")}\nOffline rehearsal; live status: not-run`,
    review: "Review each synthetic classification before accepting the result.",
    proof: "The classification is computed locally from synthetic data. No Copilot run, remote service, or live feature check occurred.",
  };
}
export function rehearsalScenario(id, feature) {
  const scenarios = {
    "computer-use": {
      title: "Synthetic service desk",
      before: "Ticket: DEMO-1042\nStatus: Draft\nNext step: Unassigned",
      after: "Ticket: DEMO-1042\nStatus: Ready for pilot\nNext step: Validate policy in test tenant.",
      review: "Approve only two text edits to the named synthetic document.",
      proof: "Both exact edits match the fixture contract. No app was controlled.",
    },
    "dynamic-workflows": {
      title: "Two bounded architecture records",
      before: "northwind-api  SSO yes | audit yes | egress approved\ncontoso-batch  SSO yes | audit NO  | egress approved",
      after: "northwind-api  pilot-with-review\ncontoso-batch  BLOCKED: missing audit\nCheckpoint: human-review",
      review: "Review both synthetic assessments before allowing continuation.",
      proof: "Missing audit blocks the second app. This is a local simulation, not an SDK run.",
    },
    "agentic-workflows": {
      title: "Candidate, not catalog entry",
      before: "Official feed -> DEMO-CAPABILITY\nLifecycle: unverified\nCatalog admission: not approved",
      after: "Draft proposal: review required\nadopted: false\nMain branch: unchanged",
      review: "Allow a draft candidate proposal only; no merge or readiness promotion.",
      proof: "Candidate remains unadopted. No workflow was dispatched or PR created.",
    },
    "cloud-sandboxes": {
      title: "Execution boundary",
      before: "Task: sum [2, 3, 5]\nData: synthetic\nRemote session: not created",
      after: "sum: 10\nexecution: local-rehearsal\nRemote session: not created",
      review: "A real cloud session needs separate access and budget approval.",
      proof: "The arithmetic is verified locally. Remote Linux execution has NOT been demonstrated.",
    },
    "copilot-memory": {
      title: "A synthetic convention",
      before: "Convention: lowercase, hyphenated ticket IDs\nInput: Demo Ticket\nServer-side memory: none",
      after: 'Output: {"id":"demo-ticket"}\nServer-side memory: none',
      review: "A real memory demo must use a cited repository fact, not a user preference.",
      proof: "Normalization is verified locally. No memory was stored or retrieved.",
    },
    autopilot: {
      title: "Measurable completion",
      before: "discount(120, 25) -> 95\nExpected -> 90\nAcceptance tests: failing",
      after: "discount(120, 25) -> 90\nInvalid inputs -> rejected\nAcceptance tests: expected contract illustrated",
      review: "Allow a repair to the implementation only; do not change the tests.",
      proof: "The expected repair is illustrated. No model or actual test runner was invoked by this page.",
    },
  };
  if (!Object.hasOwn(scenarios, id) && feature?.id === id && feature.demo?.recipe) return recipeScenario(feature);
  if (!Object.hasOwn(scenarios, id)) throw new Error(`No rehearsal scenario for ${id}`);
  return scenarios[id];
}

export const validateDemoRecipe = validateRecipe;
export const recipeResult = runRecipe;
