import { rehearsalScenario, verdictLabels } from "./model.mjs";
import { escapeHtml as html } from "../shared/text.mjs";

export function createDemoStudio({ $, $$, data, icon, commandBox, resultFor, toast, download, showView }) {
  let labFeature = "computer-use";
  let labStep = 0;
  let labStopped = false;
  let videoDuration = 90;
  let videoBrief;
  function renderLab() {
    const feature = data.features.find((entry) => entry.id === labFeature);
    const scenario = rehearsalScenario(labFeature, data.features.find((feature) => feature.id === labFeature));
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
      <figure class="lab-illustration">${data.visuals[feature.id].svg}<figcaption>Concept illustration: ${html(data.visuals[feature.id].caption)} Not a product screenshot or live run.</figcaption></figure>
      <div class="lab-context"><label>${labStep < 2 || labStopped ? "SYNTHETIC INPUT" : "LOCAL ILLUSTRATION"}</label><pre>${html(labStep < 2 || labStopped ? scenario.before : scenario.after)}</pre></div>
      <p class="lab-note" role="status">${html(label)}</p>
      <div class="lab-actions"><button class="button button-primary" id="lab-advance" ${labStep === 3 || labStopped ? "disabled" : ""}>${actionLabel}</button><button class="button" id="lab-stop" ${labStopped || labStep === 3 ? "disabled" : ""}>Stop</button><button class="button" id="lab-reset">${icon("sync")}Reset rehearsal</button></div>
      <div class="lab-kit"><strong>Ready for the real feature?</strong><p>Prepare a marked synthetic workspace. Local reset does not reset account settings or remote state.</p>${commandBox(`npm run demo:setup -- ${feature.id}`)}<button class="button button-small" data-open="${feature.id}" data-tab="demo">Open full presenter kit ${icon("arrow-right")}</button><p class="lab-note">${html(feature.demo.remoteCleanup)}</p></div>`;
  }

  function demoSteps(feature) {
    return [
      ["Prepare", "npm run demo:setup", "Create the marked synthetic workspace; confirm eligibility, permissions and budget first.", `npm run demo:setup -- ${feature.id}`],
      ["Run with review", "Copilot + human review", "Use the presenter prompt in the approved feature surface. This page never runs it.", feature.demo.prompt],
      ["Verify evidence", "npm run demo:verify", "Check the fixture output. This helper is not proof that the real Copilot feature ran.", `npm run demo:verify -- ${feature.id}`],
      ["Reset safely", "npm run demo:reset", "Reset only the marked local workspace. Follow the separate remote-cleanup instructions.", `npm run demo:reset -- ${feature.id}`],
    ];
  }

  function renderDemoStudio() {
    const feature = data.features.find((entry) => entry.id === labFeature);
    videoBrief = undefined;
    $("#demo-studio").innerHTML = `<div class="section-heading"><div><span class="eyebrow">${icon("checklist")}ILLUSTRATED PRESENTER GUIDE</span><h2 id="demo-studio-title" tabindex="-1">How to demo ${html(feature.name)}</h2><p>Original command illustrations, not screenshots. Select a rehearsal above to change the guide and recording brief.</p></div></div>
      <div class="demo-guide-steps">${demoSteps(feature).map(([title, label, detail, command], index) => `<article class="demo-guide-step">
        <svg class="demo-step-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 144" role="img" aria-label="${html(title)} command illustration"><title>${html(title)}: ${html(label)}</title><rect width="320" height="144" fill="var(--cp-link-panel)"/><rect x="20" y="20" width="280" height="104" rx="10" fill="var(--cp-surface)" stroke="var(--cp-border)" stroke-width="2"/><circle cx="38" cy="38" r="4" fill="var(--cp-accent)"/><circle cx="52" cy="38" r="4" fill="var(--cp-warning)"/><circle cx="66" cy="38" r="4" fill="var(--cp-link)"/><text x="36" y="74" font-size="18" font-weight="600" fill="var(--cp-text)">${String(index + 1).padStart(2, "0")} / ${html(title)}</text><text x="36" y="103" font-family="Consolas, monospace" font-size="15" fill="var(--cp-text)">${html(label)}</text></svg>
        <div><h3>${html(title)}</h3><p>${html(detail)}</p>${commandBox(command)}</div></article>`).join("")}</div>
      <section class="video-planner" aria-labelledby="video-planner-title"><div class="video-planner-heading"><span class="feature-icon">${icon("device-camera-video")}</span><div><span class="eyebrow">DEMO VIDEO STUDIO &middot; VISION</span><h2 id="video-planner-title" tabindex="-1">Plan a recording. Automate it later.</h2></div><span class="badge badge-experimental">Recorder not connected</span></div>
        <p id="video-boundary">No video has been generated. The available action builds a local storyboard and downloadable recording brief; it does not launch Copilot, Computer Use, GitHub Actions or a recorder.</p>
        <div class="video-controls"><label for="video-duration">Target video length<select id="video-duration"><option value="90" ${videoDuration === 90 ? "selected" : ""}>90 seconds</option><option value="180" ${videoDuration === 180 ? "selected" : ""}>3 minutes</option></select></label><button class="button button-primary" id="build-video-brief">${icon("checklist")}Build recording brief</button><button class="button" disabled aria-describedby="video-boundary">${icon("device-camera-video")}Generate video (backend planned)</button></div>
        <p class="context-hint">Target duration is a storyboard assumption, not a recording-time guarantee. Changing the feature or duration invalidates the previous brief.</p>
        <div id="video-brief" hidden><h3>Recording brief</h3><div class="video-timeline" id="video-timeline"></div><pre id="video-brief-content"></pre></div>
        <div class="lab-actions"><button class="button button-small" id="download-video-brief" disabled>${icon("download")}Download recording brief (.md)</button><a class="button button-small" href="docs/integration-vision.md" download>Read the automation vision</a></div>
        <details><summary>Could GitHub Actions make the video?</summary><p>That is a future orchestration option, not a connected capability. Copilot Computer Use is documented for local macOS/Windows sessions; unattended desktop recording on Actions has not been validated here. A generic hosted Linux runner is not a supported substitute.</p><p>A future private pipeline needs an approved interactive GUI runner, synthetic fixtures, explicit application permissions, human checkpoints, separate AI/runner budgets, capture/redaction, and review before publishing a video. Browser-only recording could use Playwright instead.</p><a href="https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/computer-use" target="_blank" rel="noopener noreferrer">Official Computer Use requirements &nearr;</a></details>
      </section>`;
    $$("#demo-studio .demo-guide-step [data-copy]").forEach((button, index) => {
      button.setAttribute("aria-label", `Copy ${demoSteps(feature)[index][0].toLowerCase()} instruction`);
    });
  }

  function buildVideoBrief() {
    const feature = data.features.find((entry) => entry.id === labFeature);
    const timestamp = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    const boundaries = [0, .15, .35, .8, 1].map((fraction) => Math.round(fraction * videoDuration));
    const scenes = demoSteps(feature).map(([title, , detail], index) => ({
      time: `${timestamp(boundaries[index])}-${timestamp(boundaries[index + 1])}`,
      title, detail,
    }));
    videoBrief = `# Copilot Runway recording brief: ${feature.name}\n\nPLANNED ONLY. No video, Copilot run, WorkIQ query, GUI automation or Actions job was created.\nTarget length: ${videoDuration} seconds (an assumption, not a guarantee).\nCurrent pilot verdict: ${verdictLabels[resultFor(feature)]}; scenario fit does not grant enterprise approval.\n\n## Storyboard\n${scenes.map((scene) => `- ${scene.time} | ${scene.title}: ${scene.detail}`).join("\n")}\n\n## Presenter instructions\n${demoSteps(feature).map(([title, , , command]) => `### ${title}\n\n${command}`).join("\n\n")}\n\n## Evidence to show\n${feature.demo.expected}\n\n## Remote cleanup (separate from local reset)\n${feature.demo.remoteCleanup}\n\n## Recording guardrails\n- Use only synthetic fixtures; no customer accounts, messages, credentials or personal data.\n- Validate account eligibility, admin policy, application permissions and OS-session support before the live demo.\n- Copilot Computer Use is documented for local macOS/Windows. Unattended Actions GUI recording is unvalidated here; hosted Linux is not a substitute.\n- Review human checkpoints and stop conditions; do not bypass approvals to make an unattended recording work.\n- Approve AI-credit and runner/capture budgets separately; no job is dispatched by this brief.\n- Review and redact the recording, prove the demonstrated output, then approve publication. Never label a concept illustration as a live recording.\n\n## Full runbook\nhttps://github.com/aj-enns/copilot-runway/blob/main/${feature.demo.runbook}\n\n## Future integration blueprint\nhttps://github.com/aj-enns/copilot-runway/blob/main/docs/integration-vision.md\n`;
    $("#video-timeline").innerHTML = scenes.map((scene) => `<div><span>${html(scene.time)}</span><strong>${html(scene.title)}</strong><p>${html(scene.detail)}</p></div>`).join("");
    $("#video-brief-content").textContent = videoBrief;
    $("#video-brief").hidden = false;
    $("#download-video-brief").disabled = false;
    toast("Recording brief built locally. No video or external job was created.");
  }

  $("#show-demo-guide").addEventListener("click", () => {
    $("#demo-studio").scrollIntoView({ block: "start" });
    $("#demo-studio-title").focus({ preventScroll: true });
  });
  $("#show-video-planner").addEventListener("click", () => {
    $(".video-planner").scrollIntoView({ block: "start" });
    $("#video-planner-title").focus({ preventScroll: true });
  });
  $("#demo-studio").addEventListener("change", (event) => {
    if (event.target.id !== "video-duration") return;
    videoDuration = Number(event.target.value);
    videoBrief = undefined;
    $("#video-brief").hidden = true;
    $("#download-video-brief").disabled = true;
  });
  $("#demo-studio").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button?.id === "build-video-brief") buildVideoBrief();
    if (button?.id === "download-video-brief" && videoBrief) download(`runway-${labFeature}-recording-brief.md`, videoBrief);
  });
  function handleClick(button) {
    if (button.dataset.rehearse || button.dataset.lab) {
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
    } else return false;
    return true;
  }
  return { renderLab, renderDemoStudio, handleClick };
}
