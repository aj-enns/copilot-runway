export * from "../shared/evidence.mjs";
export * from "../shared/recipes.mjs";
export { rehearsalScenario } from "./rehearsals.mjs";
import { validateRecipe, runRecipe } from "../shared/recipes.mjs";

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
export const validateDemoRecipe = validateRecipe;
export const recipeResult = runRecipe;
