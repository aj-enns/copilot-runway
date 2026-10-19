export const recipeOperation = "classify-required-booleans";
const plainText = /^[A-Za-z0-9][A-Za-z0-9 .,:;'"()\/+%#=?-]*$/;

function exactKeys(value, keys, label) {
  const prototype = value && typeof value === "object" ? Object.getPrototypeOf(value) : undefined;
  if (!value || Array.isArray(value) || (prototype !== Object.prototype && prototype !== null) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Error(`Recipe ${label} must contain exactly: ${keys.join(", ")}`);
}

function safeText(value, max, label) {
  if (typeof value !== "string" || value.length > max || !plainText.test(value) || value !== value.trim()) {
    throw new Error(`Recipe ${label} must be plain text of at most ${max} characters`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export const sameRecipeOutput = (a, b) => canonical(a) === canonical(b);

export function parseRecipeInput(text) {
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("Recipe input.json is not valid JSON");
  }
  exactKeys(input, ["operation", "requiredFields", "records"], "input");
  if (input.operation !== recipeOperation) throw new Error(`Unsupported recipe operation; only ${recipeOperation} is supported`);
  const fields = input.requiredFields;
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > 5 || new Set(fields).size !== fields.length ||
    fields.some((field) => typeof field !== "string" || !/^[a-z][A-Za-z0-9]{0,30}$/.test(field))) {
    throw new Error("Recipe requiredFields must be 1-5 unique camelCase names");
  }
  if (!Array.isArray(input.records) || input.records.length < 1 || input.records.length > 10) throw new Error("Recipe records must contain 1-10 items");
  for (const record of input.records) {
    exactKeys(record, ["id", ...fields], "record");
    if (typeof record.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(record.id) || fields.some((field) => typeof record[field] !== "boolean")) {
      throw new Error("Recipe records need a lowercase id and boolean required fields");
    }
  }
  if (new Set(input.records.map((record) => record.id)).size !== input.records.length) throw new Error("Recipe record IDs must be unique");
  return input;
}

function classify(input) {
  const results = input.records.map((record) => {
    const missing = input.requiredFields.filter((field) => record[field] !== true);
    return { id: record.id, decision: missing.length ? "blocked" : "pass", missing };
  });
  const blocked = results.filter((result) => result.decision === "blocked").length;
  return {
    schemaVersion: 1, operation: recipeOperation, classification: "synthetic",
    summary: { total: results.length, passed: results.length - blocked, blocked }, results,
  };
}

export function validateRecipe(recipe) {
  exactKeys(recipe, ["schemaVersion", "files", "output", "expected", "steps", "controlStory"], "recipe");
  if (recipe.schemaVersion !== 1) throw new Error("Unsupported recipe schemaVersion");
  exactKeys(recipe.files, ["input.json"], "files");
  if (typeof recipe.files["input.json"] !== "string" || recipe.files["input.json"].length > 4096) throw new Error("Recipe input.json must be a string of at most 4096 characters");
  if (typeof recipe.output !== "string" || !/^[a-z][a-z0-9-]{0,39}\.json$/.test(recipe.output) || recipe.output.startsWith("offline-")) {
    throw new Error("Recipe output must be a simple lowercase .json name");
  }
  const computed = classify(parseRecipeInput(recipe.files["input.json"]));
  if (!sameRecipeOutput(recipe.expected, computed)) throw new Error("Recipe expected output does not match the deterministic operation result");
  if (!Array.isArray(recipe.steps) || recipe.steps.length < 1 || recipe.steps.length > 6) throw new Error("Recipe steps must contain 1-6 items");
  recipe.steps.forEach((step, index) => {
    exactKeys(step, ["title", "detail"], `step ${index + 1}`);
    safeText(step.title, 60, `step ${index + 1} title`);
    safeText(step.detail, 240, `step ${index + 1} detail`);
  });
  if (!Array.isArray(recipe.controlStory) || recipe.controlStory.length !== 3) throw new Error("Recipe controlStory must contain exactly three items");
  recipe.controlStory.forEach((item, index) => safeText(item, 60, `controlStory ${index + 1}`));
  return recipe;
}

export function runRecipe(recipe) {
  return classify(parseRecipeInput(validateRecipe(recipe).files["input.json"]));
}

