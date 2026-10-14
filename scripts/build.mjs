import { readFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import octicons from "@primer/octicons";
import { fromRoot, loadCatalog, readJson, write } from "./lib.mjs";
import { validateCatalog, validateFiles } from "./validate.mjs";
import { featureVisual } from "../site/feature-visuals.mjs";

const data = await loadCatalog();
validateCatalog(data, await readJson(fromRoot("catalog", "watch.json")));
await validateFiles(data, true);
const iconNames = [
  "copilot", "mark-github", "apps", "shield-lock", "play", "meter", "broadcast",
  "verified", "plus", "sun", "moon", "search", "info", "alert", "download",
  "copy", "check", "diff", "sync", "x", "arrow-right", "git-commit",
  ...data.features.map((feature) => feature.icon),
];
data.icons = {};
for (const name of new Set(iconNames)) {
  if (!octicons[name]) throw new Error(`Official Octicon not found: ${name}`);
  data.icons[name] = octicons[name].toSVG({ "aria-hidden": "true" });
}
for (const feature of data.features) {
  feature.demo.runbookText = await readFile(fromRoot(feature.demo.runbook), "utf8");
}
const [template, styles, model, app] = await Promise.all([
  readFile(fromRoot("site", "index.html"), "utf8"),
  readFile(fromRoot("site", "styles.css"), "utf8"),
  readFile(fromRoot("site", "model.mjs"), "utf8"),
  readFile(fromRoot("site", "app.mjs"), "utf8"),
]);
const lightTokens = styles.match(/^:root \{[\s\S]*?\n\}/)?.[0];
if (!lightTokens) throw new Error("Illustration exports require the portal theme tokens");
data.visuals = {};
for (const feature of data.features) {
  const visual = featureVisual(feature, data.icons);
  data.visuals[feature.id] = visual;
  await write(fromRoot("dist", "artifacts", "visuals", `${feature.id}.svg`),
    visual.svg.replace("<title>", `<style>${lightTokens}</style><title>`));
}
const combinedScript = `${model.replace(/^export (?=(?:const|function|async function) )/gm, "")}\n${app.replace(/^import[^\n]*\n/gm, "")}`;
if (/<\/script/i.test(combinedScript) || /<\/style/i.test(styles)) throw new Error("Unexpected HTML terminator in embedded source");
let output = template
  .replace("/*STYLES*/", () => styles)
  .replace("/*DATA*/", () => JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("/*APP*/", () => combinedScript)
  .replace("<!--COPILOT_ICON-->", () => data.icons.copilot);
// HTML parsing normalizes line endings before comparing inline-content hashes.
const hash = (value) => `'sha256-${createHash("sha256").update(value.replace(/\r\n?/g, "\n")).digest("base64")}'`;
const scriptHashes = [...output.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map((match) => hash(match[1]));
const csp = [
  "default-src 'none'",
  `script-src ${scriptHashes.join(" ")}`,
  `style-src ${hash(styles)}`,
  "img-src 'self' data:",
  "font-src 'none'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
output = output.replace("<!--CSP-->", `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
await write(fromRoot("dist", "index.html"), output);
await write(fromRoot("dist", ".nojekyll"), "");
await write(fromRoot("dist", "assets", "copilot.svg"), octicons.copilot.toSVG({ fill: "currentColor" }));
for (const feature of data.features) {
  await write(fromRoot("dist", "runbooks", `${feature.id}.md`), feature.demo.runbookText);
  await mkdir(fromRoot("dist", "assessments"), { recursive: true });
  await copyFile(fromRoot("features", feature.id, "assessment.md"), fromRoot("dist", "assessments", `${feature.id}.md`));
  await mkdir(fromRoot("dist", "artifacts", "slides"), { recursive: true });
  await copyFile(fromRoot("artifacts", "slides", `${feature.id}.pptx`), fromRoot("dist", "artifacts", "slides", `${feature.id}.pptx`));
}
await copyFile(fromRoot("artifacts", "slides", "copilot-runway.pptx"), fromRoot("dist", "artifacts", "slides", "copilot-runway.pptx"));
await write(fromRoot("dist", "readiness", "README.md"), await readFile(fromRoot("readiness", "README.md"), "utf8"));
await copyFile(fromRoot("THIRD_PARTY_NOTICES.md"), fromRoot("dist", "THIRD_PARTY_NOTICES.md"));
console.log(`Built self-contained flight deck with ${data.features.length} features, embedded official icons, no runtime network calls, and downloadable demo/assessment/slide assets.`);
