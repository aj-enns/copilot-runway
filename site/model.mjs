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

export function freshness(verifiedOn, windowDays, now = new Date()) {
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
  if (stale || statuses.some((status) => status === "fail" || status === "unknown")) return "blocked";
  if (statuses.some((status) => status === "conditional")) return "conditional";
  return "ready";
}

export function filterFeatures(features, filters, rubric, sources, now = new Date()) {
  const search = (filters.search ?? "").trim().toLowerCase();
  const words = search.split(/\s+/).filter(Boolean);
  return features.filter((feature) => {
    const haystack = [feature.id, feature.name, feature.summary, feature.category, ...feature.tags, ...feature.surfaces].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word)) &&
      (!filters.lifecycle || feature.lifecycle.status === filters.lifecycle) &&
      (!filters.readiness || verdict(feature, rubric, now, sources) === filters.readiness) &&
      (!filters.surface || feature.surfaces.includes(filters.surface));
  });
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

export function rehearsalScenario(id) {
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
  if (!Object.hasOwn(scenarios, id)) throw new Error(`No rehearsal scenario for ${id}`);
  return scenarios[id];
}
