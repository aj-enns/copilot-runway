import { escapeHtml as html, formatDate as date, formatUtcTimestamp } from "../shared/text.mjs";

export function siteUpdateMarkup(update) {
  const builtAt = update.builtAt;
  const buildTime = formatUtcTimestamp(builtAt);
  const assessedOn = update.latestAutomatedAssessmentOn;
  const scout = update.scout;
  let scoutText = scout?.state === "no-runs" ? "no runs recorded on main" : "not recorded in this build";
  if (scout?.state === "recorded") {
    const started = formatUtcTimestamp(scout.startedAt);
    scoutText = `started <time datetime="${html(scout.startedAt)}">${html(started)} UTC</time> &middot; ${html((scout.conclusion ?? scout.status).replaceAll("_", " "))} &middot; <a href="${html(scout.url)}" target="_blank" rel="noopener noreferrer">View Scout run</a>`;
  }
  return `Site built <time datetime="${html(builtAt)}">${html(buildTime)} UTC</time><br>Last Scout run: ${scoutText}<br>Scout status is a build-time snapshot, not live. A successful run does not mean its findings were published.<br>Latest automated assessment: ${assessedOn ? `<time datetime="${html(assessedOn)}">${date(assessedOn)}</time>` : "not recorded"}<br>Build and automated assessment dates do not renew human evidence verification.`;
}
