import { escapeHtml } from "../shared/text.mjs";
import { runRecipe } from "../shared/recipes.mjs";

export function featureVisual(feature, icons) {
  const accent = feature.lifecycle.status === "experimental" ? "accent" : "link";
  const color = (tone) => tone.replace(/^accent(?=-|$)/, accent);
  const rect = (x, y, width, height, tone = "surface", radius = 12, stroke = "border") =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="var(--cp-${color(tone)})" stroke="var(--cp-${color(stroke)})" stroke-width="2"/>`;
  const text = (x, y, value, size = 22, tone = "text", weight = 500) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="var(--cp-${color(tone)})">${escapeHtml(value)}</text>`;
  const line = (x1, y1, x2, y2, tone = "border") =>
    `<path d="M${x1} ${y1}H${x2}V${y2}" fill="none" stroke="var(--cp-${tone})" stroke-width="2"/>`;
  const stamp = (name, x, y, size = 28) => {
    if (!icons[name]) throw new Error(`Missing illustration icon: ${name}`);
    const viewBox = icons[name].match(/viewBox="([^"]+)"/)[1];
    const paths = icons[name].replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${viewBox}" fill="var(--cp-${accent})">${paths}</svg>`;
  };
  const header = (label) => `${rect(48, 36, 504, 248)}${rect(48, 36, 504, 48, "accent-soft")}${text(72, 68, label, 20, "text", 600)}${stamp(feature.icon, 510, 47, 24)}`;
  const recipeScene = (recipe) => {
    const output = runRecipe(recipe);
    const clip = (value) => (value.length > 18 ? `${value.slice(0, 17)}...` : value);
    return {
      title: recipe.controlStory[0],
      caption: `Offline rehearsal classifies synthetic records: ${output.summary.passed} pass, ${output.summary.blocked} blocked. Live status: ${feature.demo.liveStatus}.`,
      scene: () => `${header("SYNTHETIC RECORDS")}
        ${output.results.slice(0, 3).map((result, index) => {
          const y = 100 + index * 52;
          const pass = result.decision === "pass";
          return `${rect(72, y, 456, 42, "surface-soft", 10, pass ? "success" : "danger")}${stamp(pass ? "check" : "alert", 86, y + 8, 26)}${text(124, y + 29, clip(result.id), 20, "text", 600)}${text(380, y + 29, pass ? "PASS" : "BLOCKED", 18, "text-soft", 600)}`;
        }).join("")}
        ${rect(72, 258, 456, 20, "accent-soft", 8, "accent")}${text(84, 273, clip(recipe.controlStory[2]), 15, "text", 600)}`,
    };
  };
  const scenes = {
    "computer-use": {
      title: "Work with the app, not around it",
      caption: "A synthetic service-desk edit illustrates GUI-only work with human approval before saving.",
      scene: () => `${header("SERVICE DESK")}
        ${text(76, 126, "INC-1042", 26, "text", 650)}${rect(336, 100, 188, 38, "accent-soft", 10, "accent")}${text(352, 126, "Review required", 20)}
        ${text(76, 175, "Assigned team", 20, "text-soft")}${text(310, 175, "Platform Ops", 24)}
        ${line(76, 192, 524, 192)}${stamp("shield-lock", 76, 219)}${text(116, 240, "Approved task", 22)}
        ${rect(378, 212, 146, 48, "accent", 10, "accent")}${text(400, 244, "Save edit", 24, "accent-fg", 600)}
        <path d="M486 237l8 48 12-14 18 4z" fill="var(--cp-text)" stroke="var(--cp-surface)" stroke-width="3"/>`,
    },
    "dynamic-workflows": {
      title: "Specialists work. People decide.",
      caption: "Parallel specialist findings enter a durable journal; the workflow pauses for a human decision.",
      scene: () => `${header("RUN JOURNAL")}
        ${rect(72, 106, 216, 86, "surface-soft")}${stamp("check", 88, 122, 24)}${text(122, 141, "Architecture", 22, "text", 600)}${text(88, 174, "Finding recorded", 19, "text-soft")}
        ${rect(312, 106, 216, 86, "surface-soft")}${stamp("check", 328, 122, 24)}${text(362, 141, "Security", 22, "text", 600)}${text(328, 174, "Finding recorded", 19, "text-soft")}
        ${rect(72, 210, 456, 52, "accent-soft", 10, "accent")}${stamp("shield-lock", 88, 222, 28)}${text(128, 245, "Paused for human review", 24, "text", 600)}`,
    },
    "agentic-workflows": {
      title: "Instructions become governed automation",
      caption: "Markdown instructions run as a read-only agent job; scoped safe outputs propose a reviewable draft.",
      scene: () => `${rect(48, 48, 240, 224)}${rect(48, 48, 240, 46, "surface-soft")}${text(68, 79, "workflow.md", 22, "text", 600)}
        ${text(68, 127, "on: schedule", 20, "text-soft")}${text(68, 161, "agent: read-only", 20)}${line(68, 184, 254, 184)}
        ${rect(68, 202, 170, 40, "accent-soft", 10, "accent")}${text(84, 229, "Safe outputs", 20)}
        ${rect(314, 62, 238, 210)}${stamp("git-commit", 338, 84, 36)}${text(338, 153, "Draft issue", 28, "text", 650)}
        ${text(338, 191, "Propose, don't merge", 19, "text-soft")}${stamp("shield-lock", 338, 220)}${text(376, 242, "Human review", 20)}`,
    },
    "cloud-sandboxes": {
      title: "Isolate the task. Track the meters.",
      caption: "A hosted Linux session separates the agent workspace from the developer desktop; compute and storage remain metered.",
      scene: () => `<rect x="28" y="28" width="544" height="264" rx="24" fill="var(--cp-${accent}-soft)" stroke="var(--cp-${accent})" stroke-width="2" stroke-dasharray="8 8"/>
        ${rect(50, 54, 318, 210)}${stamp("shield-lock", 72, 72)}${text(112, 97, "Isolated Linux", 24, "text", 600)}${line(72, 116, 346, 116)}
        ${text(72, 157, "repo / synthetic-app", 20, "text-soft")}${text(72, 195, "session / running", 22)}${text(72, 239, "Hosted workspace", 20, "text-soft")}
        ${rect(390, 54, 158, 94)}${stamp("meter", 410, 70)}${text(410, 130, "Compute", 21, "text", 600)}
        ${rect(390, 170, 158, 94)}${stamp("apps", 410, 186)}${text(410, 246, "Storage", 21, "text", 600)}`,
    },
    "copilot-memory": {
      title: "Context that comes with a citation",
      caption: "Repository conventions become cited context for later assistance. Review the evidence, retention, and scope.",
      scene: () => `${rect(78, 44, 438, 222, "accent-soft", 14, "accent")}${rect(62, 58, 438, 222, "surface-soft")}${rect(46, 72, 438, 222)}
        ${stamp(feature.icon, 70, 94, 36)}${text(120, 122, "Repository context", 26, "text", 650)}
        ${line(70, 144, 460, 144)}${text(70, 183, "Use architecture conventions", 22)}
        ${rect(70, 204, 390, 42, "accent-soft", 10, "accent")}${text(88, 233, "ARCHITECTURE.md : 18", 22, "text", 600)}
        ${text(70, 278, "Check the cited evidence", 20, "text-soft")}`,
    },
    autopilot: {
      title: "Keep going. Keep the acceptance bar.",
      caption: "A bounded repair starts with failing tests, iterates against acceptance checks, and still ends in human review.",
      scene: () => `${header("BOUNDED REPAIR")}
        ${rect(72, 106, 194, 82, "surface-soft", 12, "danger")}${text(92, 139, "Failing tests", 24, "text", 600)}${text(92, 173, "Reproduce first", 19, "text-soft")}
        ${stamp("sync", 282, 124, 36)}
        ${rect(334, 106, 194, 82, "surface-soft", 12, "success")}${text(354, 139, "Fix + re-test", 24, "text", 600)}${text(354, 173, "Check acceptance", 19, "text-soft")}
        ${rect(72, 210, 456, 52, "accent-soft", 10, "accent")}${stamp("diff", 90, 222)}${text(132, 245, "Human reviews the diff", 24, "text", 600)}`,
    },
  };
  if (!Object.hasOwn(scenes, feature.id) && feature.demo?.recipe) scenes[feature.id] = recipeScene(feature.demo.recipe);
  const visual = scenes[feature.id];
  if (!visual) throw new Error(`Add a feature illustration for ${feature.id}`);
  return {
    title: visual.title,
    caption: visual.caption,
    svg: `<svg class="feature-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 320" role="img" aria-label="${escapeHtml(visual.title)}" font-family="Segoe UI, Aptos, Calibri, sans-serif"><title>${escapeHtml(feature.name)}: ${escapeHtml(visual.title)}</title><desc>${escapeHtml(visual.caption)} Original Runway concept illustration, not a product screenshot or live run.</desc><rect width="600" height="320" fill="var(--cp-${accent === "link" ? "link-panel" : "accent-soft"})"/><circle cx="564" cy="24" r="106" fill="var(--cp-${accent})" opacity=".14"/><circle cx="22" cy="310" r="92" fill="var(--cp-${accent})" opacity=".14"/>${visual.scene()}</svg>`,
  };
}
