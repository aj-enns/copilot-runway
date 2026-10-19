import { validateRecipe, parseRecipeInput, runRecipe } from "../shared/recipes.mjs";

function recipeScenario(feature) {
  const recipe = validateRecipe(feature.demo.recipe);
  const input = parseRecipeInput(recipe.files["input.json"]);
  const output = runRecipe(recipe);
  const mark = (value) => (value ? "yes" : "NO");
  return {
    title: feature.demo.title,
    before: input.records.map((record) => `${record.id}  ${input.requiredFields.map((field) => `${field} ${mark(record[field])}`).join(" | ")}`).join("\n"),
    after: `${output.results.map((result) => `${result.id}  ${result.decision}${result.missing.length ? `: missing ${result.missing.join(", ")}` : ""}`).join("\n")}\nOffline rehearsal; live status: not-run`,
    review: "Review each synthetic classification before accepting the result.",
    proof: "The classification is computed locally from synthetic data. No Copilot run, remote service, or live feature check occurred.",
  };
}
export function rehearsalScenario(id, feature) {
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
  if (!Object.hasOwn(scenarios, id) && feature?.id === id && feature.demo?.recipe) return recipeScenario(feature);
  if (!Object.hasOwn(scenarios, id)) throw new Error(`No rehearsal scenario for ${id}`);
  return scenarios[id];
}

