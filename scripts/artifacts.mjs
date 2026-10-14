import pptxgen from "pptxgenjs";
import octicons from "@primer/octicons";
import { fromRoot, loadCatalog, readJson, write, fingerprint, assessmentMarkdown, verdict, verdictLabels } from "./lib.mjs";
import { validateCatalog } from "./validate.mjs";
import { featureSourceIds, lifecycleLabels } from "../site/model.mjs";

const data = await loadCatalog();
validateCatalog(data, await readJson(fromRoot("catalog", "watch.json")));
const diagrams = {
  "computer-use": ["Observe native app", "Approve narrow scope", "Verify saved change"],
  "dynamic-workflows": ["Two synthetic inputs", "Specialist assessments", "Human-review checkpoint"],
  "agentic-workflows": ["Official source signals", "Read-only reasoning", "Draft PR, never merge"],
  "cloud-sandboxes": ["Approved identity", "Isolated cloud Linux", "Stop / review snapshot"],
  "copilot-memory": ["Cited repository fact", "Validate in new session", "Owner-managed deletion"],
  autopilot: ["Seeded failing tests", "Bounded repair loop", "Verify unchanged tests"],
};
const dark = { bg: "292929", card: "343231", text: "DEDEDE", muted: "B0B0B0", accent: "FD8EA1", border: "474747" };
const light = { bg: "F7F4EF", card: "FFFFFF", text: "242424", muted: "5C5C5C", accent: "B11F4B", border: "DEDEDE" };
const findingColors = { pass: "15803D", conditional: "925A00", unknown: "B91C1C", fail: "B91C1C" };

function presentation(title) {
  const deck = new pptxgen();
  deck.layout = "LAYOUT_WIDE";
  deck.author = "Copilot Runway";
  deck.subject = "Independent, evidence-backed enablement for Cloud Solution Architects";
  deck.title = title;
  deck.company = "Copilot Runway (independent initiative)";
  deck.lang = "en-US";
  deck.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };
  return deck;
}

function text(slide, value, x, y, w, h, theme, options = {}) {
  slide.addText(value, {
    x, y, w, h, fontFace: "Aptos", fontSize: 14, color: theme.text,
    margin: 0, breakLine: false, valign: "top", paraSpaceAfterPt: 4,
    ...options,
  });
}

function box(slide, deck, x, y, w, h, theme, color = theme.card) {
  slide.addShape(deck.ShapeType.roundRect, {
    x, y, w, h, radius: .12, rectRadius: .12,
    fill: { color }, line: { color: theme.border, width: .8 },
  });
}

function logo(slide, theme, name, x, y, size) {
  const svg = octicons[name].toSVG({ fill: `#${theme.text}` });
  slide.addImage({ data: `image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, x, y, w: size, h: size, altText: `Official GitHub ${name === "copilot" ? "Copilot" : "mark"} icon, Primer Octicons` });
}

function chrome(slide, theme, feature, page, total) {
  slide.background = { color: theme.bg };
  logo(slide, theme, "copilot", .6, .52, .32);
  text(slide, "COPILOT RUNWAY", 1.02, .55, 3.1, .24, theme, { fontSize: 11, bold: true, charSpacing: 1.4 });
  text(slide, "EVALUATE. EXPLAIN. DEMO.", 8.4, .55, 4.33, .24, theme, { fontSize: 10, color: theme.muted, align: "right", charSpacing: 1 });
  text(slide, `Independent initiative. Not an official GitHub or Microsoft product.  |  Reviewed ${feature.verifiedOn}`, .6, 6.82, 10.6, .18, theme, { fontSize: 8.5, color: theme.muted });
  text(slide, `${page} / ${total}`, 11.5, 6.82, 1.23, .18, theme, { fontSize: 8.5, color: theme.muted, align: "right" });
}

function citations(slide, feature, theme) {
  const sources = [...new Set([feature.lifecycle.source, ...feature.cost.sources])];
  const rich = [{ text: "Primary sources: ", options: { color: theme.muted } }];
  sources.forEach((id, index) => {
    rich.push({
      text: data.sources[id].shortTitle,
      options: { color: theme.accent, hyperlink: { url: data.sources[id].url }, underline: true },
    });
    if (index < sources.length - 1) rich.push({ text: "  |  ", options: { color: theme.muted } });
  });
  text(slide, rich, .6, 6.45, 12.13, .25, theme, { fontSize: 10 });
}

function notes(slide, feature, purpose) {
  slide.addNotes([
    purpose,
    `Exact lifecycle: ${feature.lifecycle.status}. ${feature.lifecycle.note}`,
    `Verification date: ${feature.verifiedOn}. Evidence older than ${data.rubric.reviewWindowDays} days requires re-review.`,
    "This is independent enablement for a controlled pilot, not production certification or customer-specific approval.",
    `Cost detail: ${feature.cost.detail}`,
    `Explicit assumptions:\n${feature.cost.assumptions.join("\n")}`,
    `Complete assessment: https://github.com/${data.repository}/blob/main/features/${feature.id}/assessment.md`,
    `Presenter runbook: https://github.com/${data.repository}/blob/main/${feature.demo.runbook}`,
    `Kit validation: ${feature.demo.status}. Live feature validation: ${feature.demo.liveStatus}.`,
    `Remote cleanup: ${feature.demo.remoteCleanup}`,
    `Primary sources:\n${featureSourceIds(feature).map((id) => `${data.sources[id].title}: ${data.sources[id].url}`).join("\n")}`,
    "Official icons from Primer Octicons under MIT; see THIRD_PARTY_NOTICES.md. Other diagrams are original Runway artwork.",
  ]);
}

function valueSlide(deck, feature, page = 1, total = 2) {
  const slide = deck.addSlide();
  chrome(slide, dark, feature, page, total);
  const subtype = feature.id === "dynamic-workflows" ? " SDK" : feature.id === "autopilot" ? " CLI" : "";
  const lifecycle = lifecycleLabels[feature.lifecycle.status].toUpperCase() +
    (feature.lifecycle.status === "experimental" ? subtype : "");
  text(slide, lifecycle, .6, 1.05, 7.0, .24, dark, { fontSize: 11, color: dark.accent, bold: true, charSpacing: 1.3 });
  text(slide, feature.name, .6, 1.45, 7.25, .85, dark, { fontFace: "Aptos Display", fontSize: 38, bold: true });
  text(slide, feature.tagline, .6, 2.35, 6.95, .7, dark, { fontSize: 18, color: dark.muted });
  feature.value.forEach((value, index) => {
    const y = 3.27 + index * .83;
    slide.addShape(deck.ShapeType.ellipse, { x: .6, y: y + .04, w: .35, h: .35, fill: { color: dark.accent }, line: { color: dark.accent } });
    text(slide, String(index + 1), .6, y + .06, .35, .22, dark, { fontSize: 11, bold: true, color: dark.bg, align: "center" });
    text(slide, value, 1.15, y, 6.0, .64, dark, { fontSize: 15 });
  });
  box(slide, deck, 8.0, 1.15, 4.73, 4.87, dark);
  text(slide, "THE CONTROL STORY", 8.32, 1.47, 4.09, .24, dark, { fontSize: 10, color: dark.accent, bold: true, charSpacing: 1.2 });
  diagrams[feature.id].forEach((label, index) => {
    const y = 2.0 + index * 1.08;
    box(slide, deck, 8.36, y, 4.0, .67, dark, dark.bg);
    text(slide, label, 8.58, y + .17, 3.56, .33, dark, { fontSize: 16, align: "center", bold: index === 2 });
    if (index < 2) slide.addShape(deck.ShapeType.downArrow, {
      x: 10.13, y: y + .76, w: .42, h: .2, fill: { color: dark.accent }, line: { color: dark.accent },
    });
  });
  text(slide, feature.id === "dynamic-workflows" ? "Experimental session SDK. Not GitHub Actions." : "Observe the boundary, not just the happy path.", 8.36, 5.46, 4.0, .34, dark, { fontSize: 11, color: dark.muted, align: "center" });
  citations(slide, feature, dark);
  notes(slide, feature, `${feature.name}: what it does, where value comes from, and the bounded control story.`);
}

function readinessSlide(deck, feature, page = 2, total = 2) {
  const slide = deck.addSlide();
  chrome(slide, light, feature, page, total);
  const decision = verdict(feature, data.rubric, new Date(`${feature.verifiedOn}T12:00:00Z`), data.sources);
  text(slide, verdictLabels[decision], .6, 1.1, 12.13, .55, light, { fontSize: 30, bold: true, color: decision === "blocked" ? findingColors.unknown : light.accent });
  text(slide, `${feature.name}  |  Controlled pilot, not production certification`, .6, 1.79, 12.13, .34, light, { fontSize: 14, color: light.muted });
  text(slide, "NON-NEGOTIABLE GATES", .6, 2.33, 6.4, .25, light, { fontSize: 11, bold: true, charSpacing: 1 });
  feature.readiness.forEach((assessment, index) => {
    const column = index < 5 ? 0 : 1;
    const row = index % 5;
    const x = .6 + column * 3.4;
    const y = 2.85 + row * .61;
    const gate = data.rubric.gates.find((entry) => entry.id === assessment.gate);
    text(slide, gate.name, x, y, 3.0, .25, light, { fontSize: 12, bold: true });
    text(slide, assessment.status.toUpperCase(), x, y + .27, 3.0, .22, light, { fontSize: 9, color: findingColors[assessment.status], bold: true, charSpacing: .8 });
  });
  text(slide, "Unknowns block. Conditions need tenant evidence and a named owner.", .6, 6.02, 6.35, .3, light, { fontSize: 10, color: light.muted });
  box(slide, deck, 7.65, 2.33, 5.08, 3.12, light);
  text(slide, "COST, WITH ASSUMPTIONS", 7.9, 2.56, 4.58, .22, light, { fontSize: 10, bold: true, color: light.accent, charSpacing: .8 });
  text(slide, feature.cost.headline, 7.9, 2.99, 4.58, .68, light, { fontSize: 16, bold: true });
  text(slide, feature.cost.detail, 7.9, 3.86, 4.58, 1.35, light, { fontSize: 11.5 });
  const kitStatus = feature.demo.status.replace(/^kit-/, "").replaceAll("-", " ").toUpperCase();
  const liveStatus = feature.demo.liveStatus.replaceAll("-", " ").toUpperCase();
  text(slide, `DEMO ${feature.demo.minutes} MIN  |  KIT: ${kitStatus}  |  LIVE: ${liveStatus}`, 7.65, 5.7, 5.08, .23, light, { fontSize: 10, bold: true, color: light.accent });
  text(slide, `npm run demo:setup -- ${feature.id}`, 7.65, 6.01, 5.08, .22, light, { fontSize: 10.5, fontFace: "Consolas" });
  citations(slide, feature, light);
  notes(slide, feature, `${feature.name}: pilot decision, evidence gaps, cost assumptions, and how to start the repeatable demo kit.`);
}

const combined = presentation("Copilot Runway: architect feature briefs");
const manifest = { schemaVersion: 1, rubricVersion: data.rubric.version, generatedFromVerifiedOn: data.updatedOn, features: [] };
for (const [index, feature] of data.features.entries()) {
  for (const id of new Set([feature.lifecycle.source, ...feature.cost.sources])) {
    if (typeof data.sources[id].shortTitle !== "string" || data.sources[id].shortTitle.length > 40) {
      throw new Error(`Source ${id} requires a concise slide citation title of at most 40 characters`);
    }
  }
  const deck = presentation(`${feature.name}: value, cost, and readiness`);
  valueSlide(deck, feature);
  readinessSlide(deck, feature);
  valueSlide(combined, feature, index * 2 + 1, data.features.length * 2);
  readinessSlide(combined, feature, index * 2 + 2, data.features.length * 2);
  const deckPath = `artifacts/slides/${feature.id}.pptx`;
  const assessmentPath = `features/${feature.id}/assessment.md`;
  await write(fromRoot(assessmentPath), assessmentMarkdown(feature, data));
  await write(fromRoot(deckPath), await deck.write({ outputType: "nodebuffer" }));
  manifest.features.push({ id: feature.id, slides: 2, deck: deckPath, assessment: assessmentPath, fingerprint: fingerprint(feature, data) });
}
await write(fromRoot("artifacts", "slides", "copilot-runway.pptx"), await combined.write({ outputType: "nodebuffer" }));
await write(fromRoot("artifacts", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifest.features.length} two-slide briefs, the combined ${manifest.features.length * 2}-slide architect deck, and matching Markdown assessments with primary-source links.`);
