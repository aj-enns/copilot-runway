import { validateWorkshop, policyExport } from "./model.mjs";
import { escapeHtml as html } from "../shared/text.mjs";

export function createWorkshop({ $, data, toast, warn, download, storage = () => localStorage }) {
  let workshop = { schemaVersion: 1, rules: [] };
  const storageKey = "copilot-runway.workshop.v1";
  function loadWorkshop() {
    try {
      const raw = storage().getItem(storageKey);
      if (raw) workshop = validateWorkshop(JSON.parse(raw));
    } catch (error) {
      console.warn("Runway workshop storage:", error.message);
      warn("Saved workshop requirements could not be read. This session uses an empty local workshop; export changes before leaving.");
    }
  }

  function saveWorkshop() {
    try {
      storage().setItem(storageKey, JSON.stringify(validateWorkshop(workshop)));
    } catch (error) {
      console.warn("Runway workshop storage:", error.message);
      toast("Browser storage is unavailable. Your changes exist only in this session; export the proposed policy to keep them.");
    }
  }

  function renderWorkshop() {
    $("#local-rules").innerHTML = workshop.rules.length ? workshop.rules.map((rule) =>
      `<div class="local-rule"><span>${html(rule.name)}</span><span class="badge badge-experimental">Local proposal</span><button class="text-link" data-remove-rule="${html(rule.id)}" aria-label="Remove local requirement ${html(rule.name)}">Remove</button></div>`).join("") :
      '<p>No local additions yet. The versioned repository rubric remains authoritative.</p>';
  }

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

  function handleClick(button) {
    if (!button.dataset.removeRule) return false;
    workshop.rules = workshop.rules.filter((rule) => rule.id !== button.dataset.removeRule);
    saveWorkshop();
    renderWorkshop();
    $("#rule-name").focus();
    return true;
  }
  return { load: loadWorkshop, render: renderWorkshop, handleClick };
}
