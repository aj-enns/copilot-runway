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

export function reviewLabel(feature, formatDate = (value) => value) {
  if (feature.verifiedOn) return `Reviewed ${formatDate(feature.verifiedOn)}`;
  return feature.provenance?.assessedOn ? `Not human verified (assessed ${formatDate(feature.provenance.assessedOn)})` : "Not human verified";
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

