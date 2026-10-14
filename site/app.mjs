import { lifecycleLabels, verdictLabels, freshness, featureSourceIds, evidenceIsStale, verdict, filterFeatures, calculateCost, validateWorkshop, policyExport, rehearsalScenario } from "./model.mjs";

const data = JSON.parse(document.getElementById("runway-data").textContent);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const html = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => data.icons[name] ?? data.icons.info;
const storageKey = "copilot-runway.workshop.v1";
const viewNames = { catalog: "Flight deck", readiness: "Readiness gates", demos: "Demo lab", cost: "Cost lab", radar: "Preview radar" };
const tabNames = { overview: "Overview", readiness: "Readiness", demo: "Demo", sources: "Sources" };
let toastTimer;
let view = "catalog";
let currentFeature;
let currentTab = "overview";
let labFeature = "computer-use";
let labStep = 0;
let labStopped = false;
const compared = new Set();
const filters = { search: "", lifecycle: "", readiness: "", surface: "" };
let workshop = { schemaVersion: 1, rules: [] };

const resultFor = (feature) => verdict(feature, data.rubric, new Date(), data.sources);
const date = (value) => new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
const sourceLinks = (ids) => `<div class="source-links">${[...new Set(ids)].map((id) => `<a href="${html(data.sources[id].url)}" target="_blank" rel="noopener noreferrer">${html(data.sources[id].title)} &nearr;</a>`).join("")}</div>`;
const lifecycleBadge = (feature) => `<span class="badge ${feature.lifecycle.status === "experimental" ? "badge-experimental" : "badge-preview"}">${html(lifecycleLabels[feature.lifecycle.status])}</span>`;
const resultBadge = (feature) => `<span class="badge badge-${resultFor(feature)}">${verdictLabels[resultFor(feature)]}</span>`;
const commandBox = (command) => `<div class="command-box"><pre>${html(command)}</pre><button class="icon-button" data-copy="${html(command)}" aria-label="Copy command">${icon("copy")}</button></div>`;

function hydrateIcons(scope = document) {
  scope.querySelectorAll("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 5500);
}

function warn(message) {
  const element = $("#global-warning");
  element.hidden = false;
  element.textContent = element.textContent ? `${element.textContent} ${message}` : message;
}

function loadWorkshop() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) workshop = validateWorkshop(JSON.parse(raw));
  } catch (error) {
    console.warn("Runway workshop storage:", error.message);
    warn("Saved workshop requirements could not be read. This session uses an empty local workshop; export changes before leaving.");
  }
}

function saveWorkshop() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(validateWorkshop(workshop)));
  } catch (error) {
    console.warn("Runway workshop storage:", error.message);
    toast("Browser storage is unavailable. Your changes exist only in this session; export the proposed policy to keep them.");
  }
}

function download(name, content, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setHash(hash) {
  history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
}

function showView(name, focus = true) {
  if (!Object.hasOwn(viewNames, name)) return;
  view = name;
  $$(".view").forEach((element) => { element.hidden = element.id !== `view-${name}`; });
  $$(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
    if (button.dataset.view === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const navigation = $(".sidebar nav");
  const activeButton = $(`.nav-button[data-view="${name}"]`);
  if (navigation.scrollWidth > navigation.clientWidth) {
    navigation.scrollLeft = activeButton.offsetLeft - navigation.offsetLeft - 4;
  }
  $("#breadcrumb-view").textContent = viewNames[name];
  setHash(`#view=${name}`);
  if (focus) $("#main").focus({ preventScroll: true });
  if (name === "demos") renderLab();
}

function renderMetrics() {
  const metrics = [
    ["apps", data.features.length, "Curated capabilities", "First-wave catalog, not exhaustive"],
    ["broadcast", data.features.filter((feature) => feature.lifecycle.status === "public-preview").length, "Public previews", "Experiments shown separately"],
    ["play", data.features.filter((feature) => feature.demo.status === "kit-tested").length, "Repeatable demo kits", `${data.features.filter((feature) => feature.demo.liveStatus === "verified").length} live runs recorded`],
    ["shield-lock", data.rubric.gates.length, "Readiness gates", "Unknowns block adoption"],
  ];
  $("#metrics").innerHTML = metrics.map(([name, number, label, detail]) =>
    `<div class="metric"><span class="metric-icon">${icon(name)}</span><strong>${String(number).padStart(2, "0")}</strong><span class="metric-label">${html(label)}</span><small>${html(detail)}</small></div>`).join("");
  $(".nav-count").textContent = String(data.features.length).padStart(2, "0");
  $("#coverage-note").textContent = data.scope;
  $(".topbar-date").innerHTML = `Evidence reviewed <time datetime="${html(data.updatedOn)}">${date(data.updatedOn)}</time>`;
}

function card(feature) {
  const result = resultFor(feature);
  const passed = feature.readiness.filter((assessment) => assessment.status === "pass").length;
  const isStale = evidenceIsStale(feature, data.rubric, data.sources);
  return `<article class="feature-card ${feature.featured ? "featured" : ""}" data-feature="${feature.id}">
    <div class="card-top"><span class="feature-icon">${icon(feature.icon)}</span><div class="card-badges">${feature.featured ? '<span class="badge badge-neutral">Start here</span>' : ""}${lifecycleBadge(feature)}</div></div>
    <div class="category-label">${html(feature.category)}</div>
    <h3><button class="feature-title" data-open="${feature.id}">${html(feature.name)}</button></h3>
    <p class="summary">${html(feature.summary)}</p>
    <div class="surface-tags">${feature.surfaces.slice(0, 3).map((surface) => `<span class="surface-tag">${html(surface)}</span>`).join("")}</div>
    <div class="card-readiness"><span>${icon(result === "blocked" ? "alert" : "shield-lock")}</span><strong>${verdictLabels[result]}</strong><small>${isStale ? "Re-review overdue" : `${passed}/${data.rubric.gates.length} documented`}</small></div>
    <div class="card-kit">2-slide brief &middot; ${feature.demo.minutes}-min kit &middot; live: ${html(feature.demo.liveStatus)}</div>
    <div class="card-actions"><button class="button button-small" data-open="${feature.id}" data-tab="readiness">Assess</button><button class="button button-small" data-open="${feature.id}" data-tab="demo">${icon("play")}Demo</button><a class="button button-small" href="artifacts/slides/${feature.id}.pptx" download aria-label="Download ${html(feature.name)} slides">${icon("download")}Slides</a><button class="compare-toggle" data-compare="${feature.id}" aria-pressed="${compared.has(feature.id)}" aria-label="Compare ${html(feature.name)}">${icon(compared.has(feature.id) ? "check" : "diff")}Compare</button></div>
  </article>`;
}

function renderCatalog() {
  const features = filterFeatures(data.features, filters, data.rubric, data.sources);
  $("#feature-grid").innerHTML = features.length ? features.map(card).join("") :
    `<div class="empty-state"><h3>No capabilities match those filters.</h3><p>Try a different term or reset the filters. Discovery candidates live on Radar.</p><button class="button" data-clear-filters>Reset filters</button></div>`;
  $("#result-count").textContent = `${features.length} of ${data.features.length} capabilities`;
  $$("[data-stage]").forEach((button) => {
    const active = button.dataset.stage === filters.lifecycle;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function clearFilters() {
  Object.assign(filters, { search: "", lifecycle: "", readiness: "", surface: "" });
  $("#feature-search").value = "";
  $("#readiness-filter").value = "";
  $("#surface-filter").value = "";
  renderCatalog();
  $("#feature-search").focus();
}

function readinessContent(feature) {
  const stale = evidenceIsStale(feature, data.rubric, data.sources);
  return `${stale ? '<div class="notice notice-warning"><p>Evidence is stale. Required gates stay blocked until a maintainer re-verifies the sources; a successful automated scan does not renew an assessment.</p></div>' : ""}
    <div class="notice">${icon("shield-lock")}<div><strong>${verdictLabels[resultFor(feature)]}</strong><p>Minimum controlled-pilot assessment. No tenant-specific sign-off or production certification is implied. Rubric ${html(data.rubric.version)}; ${data.rubric.reviewWindowDays}-day review window.</p></div></div>
    <div class="table-scroll"><table class="assessment-table"><thead><tr><th scope="col">Required gate</th><th scope="col">Finding</th><th scope="col">Evidence, gap, and next action</th></tr></thead><tbody>${data.rubric.gates.map((gate) => {
      const assessment = feature.readiness.find((entry) => entry.gate === gate.id);
      return `<tr><td><strong>${html(gate.name)}</strong>${html(gate.owner)}</td><td><span class="badge badge-${assessment.status}">${html(assessment.status)}</span></td><td>${html(assessment.reason)}<p><strong>Next:</strong> ${html(assessment.next)}</p>${sourceLinks(assessment.sources)}</td></tr>`;
    }).join("")}</tbody></table></div>
    <div class="lab-actions"><a class="button button-small" href="assessments/${feature.id}.md" download>${icon("download")}Download assessment (.md)</a><button class="button button-small" data-view="readiness">Explore the non-negotiables</button></div>`;
}

function overviewContent(feature) {
  return `<p>${html(feature.summary)}</p><div class="value-grid">${feature.value.map((value, index) => `<div class="value-card"><b>VALUE ${String(index + 1).padStart(2, "0")}</b>${html(value)}</div>`).join("")}</div>
    <h3>What it takes to enable</h3>${feature.enablement.map((step, index) => `<div class="enablement-step"><strong>${index + 1}. ${html(step.title)}</strong><p>${html(step.detail)}</p>${step.command ? commandBox(step.command) : ""}${sourceLinks(step.sources)}</div>`).join("")}
    <div class="notice"><div><h3>${html(feature.cost.headline)}</h3><p>${html(feature.cost.detail)}</p><ul>${feature.cost.assumptions.map((assumption) => `<li>${html(assumption)}</li>`).join("")}</ul>${sourceLinks(feature.cost.sources)}</div></div>
    <h3>Limitations to say out loud</h3><ul>${feature.limitations.map((limit) => `<li>${html(limit)}</li>`).join("")}</ul>`;
}

function demoContent(feature) {
  return `<h3>${html(feature.demo.title)}</h3><p>${feature.demo.minutes} minutes &middot; ${html(feature.demo.mode)} &middot; kit-tested &middot; live feature validation: ${html(feature.demo.liveStatus)}</p>
    <div class="notice notice-warning"><p>Repository checks validate fixtures and offline logic, not account access, native UI automation, paid inference, policy enforcement, or remote state. Follow the complete runbook for the real feature.</p></div>
    <h3>Prepare the synthetic workspace</h3>${commandBox(`npm run demo:setup -- ${feature.id}`)}
    <h3>Presenter prompt</h3>${commandBox(feature.demo.prompt)}
    <h3>Expected evidence</h3><p>${html(feature.demo.expected)}</p>
    <h3>Verify the output, then reset</h3>${commandBox(`npm run demo:verify -- ${feature.id}`)}${commandBox(`npm run demo:reset -- ${feature.id}`)}
    <p><strong>Separate remote cleanup:</strong> ${html(feature.demo.remoteCleanup)}</p>
    <div class="lab-actions"><a class="button button-primary" href="runbooks/${feature.id}.md" download>${icon("download")}Download full runbook (.md)</a><button class="button" data-rehearse="${feature.id}">${icon("play")}Open offline rehearsal</button></div>
    <details class="runbook-full"><summary>Read the complete presenter runbook</summary><pre>${html(feature.demo.runbookText)}</pre></details>`;
}

function sourcesContent(feature) {
  return `<div class="notice"><p>Verified facts cite primary GitHub sources. Recommendations, tenant validation, and cost assumptions are separate. Lifecycle evidence is reviewed as of ${date(feature.verifiedOn)}, not guaranteed forever.</p></div>
    ${featureSourceIds(feature).map((id) => {
      const source = data.sources[id];
      const state = freshness(source.verifiedOn, data.rubric.reviewWindowDays);
      return `<div class="evidence-source"><a href="${html(source.url)}" target="_blank" rel="noopener noreferrer">${html(source.title)} &nearr;</a><small>${html(source.publisher)} &middot; ${html(source.kind)} &middot; reviewed ${date(source.verifiedOn)} &middot; ${state.stale ? "STALE: re-review required" : "within review window"}</small></div>`;
    }).join("")}`;
}

function renderFeature() {
  const feature = data.features.find((entry) => entry.id === currentFeature);
  if (!feature) return;
  const content = { overview: overviewContent, readiness: readinessContent, demo: demoContent, sources: sourcesContent }[currentTab](feature);
  $("#feature-dialog-content").innerHTML = `<div class="dialog-header"><div><span class="eyebrow">${html(feature.category)}</span><h2 id="feature-title">${html(feature.name)}</h2><p>${html(feature.tagline)}</p><div class="dialog-badges">${lifecycleBadge(feature)}${resultBadge(feature)}<span class="badge badge-neutral">Reviewed ${date(feature.verifiedOn)}</span></div></div><button class="icon-button" data-close="feature-dialog" aria-label="Close feature">${icon("x")}</button></div>
    <div class="dialog-tabs" role="tablist" aria-label="Feature detail">${Object.entries(tabNames).map(([id, name]) => `<button class="dialog-tab" id="tab-${id}" role="tab" aria-selected="${currentTab === id}" aria-controls="feature-tabpanel" tabindex="${currentTab === id ? 0 : -1}" data-tab-change="${id}">${name}</button>`).join("")}</div>
    <div class="dialog-body" id="feature-tabpanel" role="tabpanel" aria-labelledby="tab-${currentTab}">${content}</div>`;
}

function openFeature(id, tab = "overview") {
  if (!data.features.some((feature) => feature.id === id)) {
    warn("That capability is not in the assessed catalog. Check Radar for discovery candidates.");
    return;
  }
  currentFeature = id;
  currentTab = Object.hasOwn(tabNames, tab) ? tab : "overview";
  renderFeature();
  if (!$("#feature-dialog").open) $("#feature-dialog").showModal();
  setHash(`#feature=${id}&tab=${currentTab}`);
}

function renderReadiness() {
  $("#policy-version").textContent = `Enterprise readiness rubric ${data.rubric.version}`;
  $("#gate-grid").innerHTML = data.rubric.gates.map((gate, index) => `<article class="gate-card"><div class="card-top"><span class="gate-number">GATE ${String(index + 1).padStart(2, "0")}</span><span class="badge badge-neutral">${gate.required ? "Non-negotiable" : "Advisory"}</span></div><h3>${html(gate.name)}</h3><p>${html(gate.question)}</p><small>Owner: ${html(gate.owner)}</small><details><summary>Evidence and acceptance test</summary><p><strong>Evidence:</strong> ${html(gate.evidenceRequired)}</p><p><strong>Test:</strong> ${html(gate.test)}</p></details></article>`).join("");
  renderWorkshop();
}

function renderWorkshop() {
  $("#local-rules").innerHTML = workshop.rules.length ? workshop.rules.map((rule) =>
    `<div class="local-rule"><span>${html(rule.name)}</span><span class="badge badge-experimental">Local proposal</span><button class="text-link" data-remove-rule="${html(rule.id)}" aria-label="Remove local requirement ${html(rule.name)}">Remove</button></div>`).join("") :
    '<p>No local additions yet. The versioned repository rubric remains authoritative.</p>';
}

function renderLab() {
  const feature = data.features.find((entry) => entry.id === labFeature);
  const scenario = rehearsalScenario(labFeature);
  $("#demo-chooser").innerHTML = data.features.map((entry) => `<button class="demo-choice ${entry.id === labFeature ? "active" : ""}" data-lab="${entry.id}" aria-pressed="${entry.id === labFeature}"><span>${icon(entry.icon)}</span><span><strong>${html(entry.name)}</strong><small>${entry.demo.minutes}-min live runbook</small></span></button>`).join("");
  const label = labStopped ? "Rehearsal stopped; no external action occurred." : [
    "Inspect the synthetic context before deciding what to permit.",
    scenario.review,
    "The requested transformation is shown locally. Verify the result instead of trusting a completion message.",
    scenario.proof,
  ][labStep];
  const actionLabel = ["Inspect synthetic context", "Approve local rehearsal", "Verify fixture story", "Rehearsal complete"][labStep];
  $("#demo-lab").innerHTML = `<div class="lab-header"><div><span class="eyebrow">OFFLINE FLIGHT LAB</span><h2>${html(scenario.title)}</h2><p>${html(feature.name)} &middot; no Copilot service called</p></div><span class="badge ${labStopped ? "badge-blocked" : labStep === 3 ? "badge-ready" : "badge-neutral"}">${labStopped ? "Stopped" : labStep === 3 ? "Rehearsal checked" : "Synthetic only"}</span></div>
    <div class="lab-steps">${["01 Observe", "02 Review", "03 Verify"].map((name, index) => `<div class="lab-step ${labStep >= index + 1 ? "active" : ""}">${name}</div>`).join("")}</div>
    <div class="lab-context"><label>${labStep < 2 || labStopped ? "SYNTHETIC INPUT" : "LOCAL ILLUSTRATION"}</label><pre>${html(labStep < 2 || labStopped ? scenario.before : scenario.after)}</pre></div>
    <p class="lab-note" role="status">${html(label)}</p>
    <div class="lab-actions"><button class="button button-primary" id="lab-advance" ${labStep === 3 || labStopped ? "disabled" : ""}>${actionLabel}</button><button class="button" id="lab-stop" ${labStopped || labStep === 3 ? "disabled" : ""}>Stop</button><button class="button" id="lab-reset">${icon("sync")}Reset rehearsal</button></div>
    <div class="lab-kit"><strong>Ready for the real feature?</strong><p>Prepare a marked synthetic workspace. Local reset does not reset account settings or remote state.</p>${commandBox(`npm run demo:setup -- ${feature.id}`)}<button class="button button-small" data-open="${feature.id}" data-tab="demo">Open full presenter kit ${icon("arrow-right")}</button><p class="lab-note">${html(feature.demo.remoteCleanup)}</p></div>`;
}

function getCostInputs() {
  return Object.fromEntries(["credits", "minutes", "memoryGiB", "snapshotGiB", "months"].map((name) => {
    const value = $("#cost-form").elements.namedItem(name).value;
    if (!value.trim()) throw new Error("Complete every scenario input; blank values are not zero.");
    return [name, Number(value)];
  }));
}

function renderCost() {
  try {
    const inputs = getCostInputs();
    const result = calculateCost(inputs);
    const rows = [
      ["AI-credit usage", result.ai, `${inputs.credits} assumed chargeable credits x USD 0.01`],
      ["Sandbox compute", result.compute, `${inputs.minutes * 60} seconds x USD 0.000024`],
      ["Allocated memory", result.memory, `${inputs.minutes * 60} seconds x ${inputs.memoryGiB} GiB x USD 0.000003`],
      ["Retained snapshots", result.storage, `${inputs.snapshotGiB} GiB x ${inputs.months} months x USD 0.005`],
    ];
    $("#cost-result").innerHTML = `<div class="cost-total">${money(result.total)}</div><small>USD &middot; illustrative marginal usage, not total subscription cost</small><div class="cost-breakdown">${rows.map(([name, value, assumption]) => `<div class="cost-line"><span>${name}<small>${html(assumption)}</small></span><strong>${money(value)}</strong></div>`).join("")}</div>`;
    $("#export-cost").disabled = false;
  } catch (error) {
    $("#cost-result").innerHTML = `<div class="notice notice-warning" role="alert">${html(error.message)}</div>`;
    $("#export-cost").disabled = true;
  }
}

function renderRadar() {
  const scan = data.monitor.lastSuccessfulScan;
  const staleCount = data.features.filter((feature) => freshness(feature.verifiedOn, data.rubric.reviewWindowDays).stale).length;
  $("#radar-summary").innerHTML = `<div class="radar-stat">Last successful scan: <strong>${scan ? date(scan) : "not recorded"}</strong></div><div class="radar-stat"><strong>${data.monitor.items.length}</strong> candidate signals in snapshot</div><div class="radar-stat"><strong>${staleCount}</strong> overdue feature reviews</div><div class="radar-stat">Agentic reasoning: <strong>administrator opt-in</strong></div>`;
  $("#radar-items").innerHTML = data.monitor.items.length ? data.monitor.items.map((item) =>
    `<article class="radar-item"><span>${icon(item.signal === "preview-signal" ? "broadcast" : "git-commit")}</span><div><h3><a href="${html(item.url)}" target="_blank" rel="noopener noreferrer">${html(item.title)} &nearr;</a></h3><p>${html(item.summary)}</p><small>${html(item.feed)} &middot; ${date(item.publishedOn)} &middot; discovery only, review required</small></div><span class="badge badge-neutral">${html(item.signal.replaceAll("-", " "))}</span></article>`).join("") :
    '<div class="empty-state"><h3>No successful scan recorded yet.</h3><p>The scheduled workflow must fetch all configured official sources successfully before publishing a snapshot.</p></div>';
}

function renderComparison() {
  $("#compare-rail").hidden = compared.size === 0;
  $("#compare-open").disabled = compared.size < 2;
  $("#compare-selection").innerHTML = `<strong>${compared.size}/3 SELECTED</strong>${[...compared].map((id) => html(data.features.find((feature) => feature.id === id).name)).join(" &middot; ")}`;
}

function openComparison() {
  if (compared.size < 2) return;
  const selected = data.features.filter((feature) => compared.has(feature.id));
  const row = (name, values) => `<tr><th scope="row">${html(name)}</th>${values.map((value) => `<td>${value}</td>`).join("")}</tr>`;
  $("#compare-table").innerHTML = `<table><thead><tr><th scope="col">Evidence dimension</th>${selected.map((feature) => `<th scope="col">${html(feature.name)}</th>`).join("")}</tr></thead><tbody>
    ${row("Release stage", selected.map((feature) => lifecycleBadge(feature)))}
    ${row("Pilot verdict", selected.map(resultBadge))}
    ${row("Execution surface", selected.map((feature) => html(feature.surfaces.join(", "))))}
    ${row("Cost implication", selected.map((feature) => html(feature.cost.headline)))}
    ${data.rubric.gates.map((gate) => row(gate.name, selected.map((feature) => {
      const entry = feature.readiness.find((assessment) => assessment.gate === gate.id);
      return `<span class="badge badge-${entry.status}">${html(entry.status)}</span><p>${html(entry.reason)}</p>`;
    }))).join("")}
    ${row("Demo evidence", selected.map((feature) => `Kit-tested; live: ${html(feature.demo.liveStatus)}`))}
    </tbody></table>`;
  $("#compare-dialog").showModal();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button, a[data-view]");
  if (!button) return;
  if (button.dataset.view) {
    if ($("#feature-dialog").open) $("#feature-dialog").close();
    showView(button.dataset.view);
  } else if (button.dataset.open) {
    openFeature(button.dataset.open, button.dataset.tab);
  } else if (button.dataset.close) {
    document.getElementById(button.dataset.close).close();
  } else if (button.dataset.tabChange) {
    currentTab = button.dataset.tabChange;
    renderFeature();
    $(`#tab-${currentTab}`).focus();
    setHash(`#feature=${currentFeature}&tab=${currentTab}`);
  } else if (Object.hasOwn(button.dataset, "stage")) {
    filters.lifecycle = button.dataset.stage;
    renderCatalog();
  } else if (Object.hasOwn(button.dataset, "clearFilters")) {
    clearFilters();
  } else if (button.dataset.compare) {
    const id = button.dataset.compare;
    if (compared.has(id)) compared.delete(id);
    else if (compared.size < 3) compared.add(id);
    else toast("Compare up to three capabilities at a time. Remove one before adding another.");
    renderCatalog();
    renderComparison();
    $(`[data-compare="${id}"]`)?.focus();
  } else if (Object.hasOwn(button.dataset, "copy")) {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      toast("Copied. Review the command and prerequisites before running it.");
    } catch (error) {
      console.warn("Clipboard unavailable:", error.message);
      toast("Clipboard access is unavailable. Select and copy the visible command manually.");
    }
  } else if (button.dataset.removeRule) {
    workshop.rules = workshop.rules.filter((rule) => rule.id !== button.dataset.removeRule);
    saveWorkshop();
    renderWorkshop();
    $("#rule-name").focus();
  } else if (button.dataset.rehearse || button.dataset.lab) {
    labFeature = button.dataset.rehearse ?? button.dataset.lab;
    labStep = 0;
    labStopped = false;
    if ($("#feature-dialog").open) $("#feature-dialog").close();
    showView("demos", false);
    renderLab();
    $("#lab-advance").focus();
  } else if (button.id === "lab-advance") {
    labStep = Math.min(labStep + 1, 3);
    renderLab();
    $("#lab-advance").focus();
  } else if (button.id === "lab-stop") {
    labStopped = true;
    renderLab();
    $("#lab-reset").focus();
  } else if (button.id === "lab-reset") {
    labStep = 0;
    labStopped = false;
    renderLab();
    $("#lab-advance").focus();
    toast("Browser rehearsal reset. No local files, account settings, or remote state were changed.");
  }
});

$("#feature-search").addEventListener("input", (event) => { filters.search = event.target.value; renderCatalog(); });
$("#readiness-filter").addEventListener("change", (event) => { filters.readiness = event.target.value; renderCatalog(); });
$("#surface-filter").addEventListener("change", (event) => { filters.surface = event.target.value; renderCatalog(); });
$("#compare-open").addEventListener("click", openComparison);
$("#compare-clear").addEventListener("click", () => {
  const firstSelected = [...compared][0];
  compared.clear();
  renderComparison();
  renderCatalog();
  ($(`[data-compare="${firstSelected}"]`) ?? $("#feature-search")).focus();
});
$("#feature-dialog").addEventListener("close", () => { currentFeature = undefined; setHash(`#view=${view}`); });

$("#rule-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#rule-name");
  if (!input.checkValidity()) { input.reportValidity(); return; }
  if (workshop.rules.length >= 25) { toast("Keep the local workshop bounded to 25 additions. Export and review before extending it."); return; }
  const name = input.value.trim();
  if (name.length < 3) { toast("Enter at least three non-whitespace characters."); return; }
  workshop.rules.push({ id: `local-${crypto.randomUUID()}`, name, required: true, scope: "local-workshop" });
  saveWorkshop();
  renderWorkshop();
  input.value = "";
  toast("Added locally. Export and propose a repository change for durable adoption.");
});

$("#export-policy").addEventListener("click", () => {
  download("runway-proposed-readiness-policy.json", `${JSON.stringify(policyExport(data.rubric, workshop), null, 2)}\n`, "application/json");
});

$("#cost-form").addEventListener("input", renderCost);
$("#cost-form").addEventListener("submit", (event) => { event.preventDefault(); renderCost(); });
$("#export-cost").addEventListener("click", () => {
  const inputs = getCostInputs();
  const estimate = calculateCost(inputs);
  download("runway-cost-assumptions.md", `# Copilot Runway: illustrative cost scenario\n\n` +
    `Not a tenant quote. Chargeable AI credits are assumed to be beyond any included pool.\n\n` +
    Object.entries(inputs).map(([key, value]) => `- ${key}: ${value}`).join("\n") +
    `\n\nEstimated metered usage: ${money(estimate.total)} USD.\n` +
    `AI ${money(estimate.ai)}; compute ${money(estimate.compute)}; memory ${money(estimate.memory)}; storage ${money(estimate.storage)}.\n\n` +
    `Excludes seats, Actions, other services, taxes, discounts, and usage elsewhere. Runtime caps are not billing hard stops.\n\n` +
    `Allocation, runtime, and retention are assumptions, not promised SKUs. Within a Git repository, its owner is billed; outside one, choose an approved billable owner.\n\n` +
    `Cloud compute/storage require product/SKU budgets separate from bundled AI-credit budgets. No expired preview trial allowance is assumed.\n\n` +
    `Official sources reviewed ${data.updatedOn}:\n${["billing", "sandbox-billing", "sandboxes"].map((id) => `- ${data.sources[id].url}`).join("\n")}\n`);
});

function renderThemeToggle() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  $("#theme-toggle").setAttribute("aria-label", `Switch to ${nextTheme} theme`);
  $("#theme-toggle").innerHTML = icon(nextTheme === "light" ? "sun" : "moon");
}

$("#theme-toggle").addEventListener("click", () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  renderThemeToggle();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !$("#feature-dialog").open && !$("#compare-dialog").open) {
    event.preventDefault();
    showView("catalog", false);
    $("#feature-search").focus();
  }
  if (event.target.matches("[role=tab]") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const ids = Object.keys(tabNames);
    const index = ids.indexOf(currentTab);
    currentTab = event.key === "Home" ? ids[0] : event.key === "End" ? ids.at(-1) :
      ids[(index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    renderFeature();
    $(`#tab-${currentTab}`).focus();
    setHash(`#feature=${currentFeature}&tab=${currentTab}`);
  }
});

window.addEventListener("hashchange", route);
function route() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has("feature")) openFeature(params.get("feature"), params.get("tab"));
  else if (params.has("view")) {
    if ($("#feature-dialog").open) $("#feature-dialog").close();
    showView(params.get("view"), false);
  }
}

hydrateIcons();
renderThemeToggle();
loadWorkshop();
renderMetrics();
renderCatalog();
renderReadiness();
renderLab();
renderCost();
renderRadar();
renderComparison();
$("#cost-sources").innerHTML = sourceLinks(["billing", "sandbox-billing", "sandboxes"]);
const staleFeatures = data.features.filter((feature) => evidenceIsStale(feature, data.rubric, data.sources));
if (staleFeatures.length) warn(`${staleFeatures.length} feature assessment(s) or their sources are past the ${data.rubric.reviewWindowDays}-day evidence window. Required gates remain on hold until re-reviewed.`);
const initialHash = location.hash;
if (initialHash) route();
else showView("catalog", false);
