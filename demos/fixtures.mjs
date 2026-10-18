import { readFileSync } from "node:fs";
import { recipeFixtures } from "./recipes.mjs";

export const applications = [
  { id: "northwind-api", sso: true, audit: true, approvedEgress: true },
  { id: "contoso-batch", sso: true, audit: false, approvedEgress: true },
];

export const supportBaseline = "COPILOT RUNWAY | SYNTHETIC SERVICE DESK\nTicket: DEMO-1042\nSystem: Northwind test application\nStatus: Draft\nNext step: Unassigned\nData classification: Synthetic only\n";
export const supportExpected = supportBaseline
  .replace("Status: Draft", "Status: Ready for pilot")
  .replace("Next step: Unassigned", "Next step: Validate policy in test tenant.");

const discountTests = `import test from "node:test";
import assert from "node:assert/strict";
import { discount } from "./discount.mjs";

test("25 percent off 120 is 90", () => assert.equal(discount(120, 25), 90));
test("zero percent preserves the price", () => assert.equal(discount(40, 0), 40));
test("100 percent produces zero", () => assert.equal(discount(40, 100), 0));
test("reject invalid prices and percentages", () => {
  for (const [price, percent] of [[-1, 10], [NaN, 10], [Infinity, 10], [40, -1], [40, 101], [40, NaN], [40, Infinity]]) {
    assert.throws(() => discount(price, percent));
  }
});
`;

export const fixtures = {
  "computer-use": {
    files: { "support-brief.txt": supportBaseline },
    outputs: [],
  },
  "dynamic-workflows": {
    files: { "apps.json": `${JSON.stringify(applications, null, 2)}\n` },
    outputs: ["assessment.json", "offline-assessment.json"],
  },
  "agentic-workflows": {
    files: {
      "brief-input.md": "# Synthetic preview candidate\n\nCandidate: DEMO-CAPABILITY\nOfficial evidence: not yet reviewed.\nLifecycle: unverified.\nRequired result: a draft review document, never an adopted feature.\n",
    },
    outputs: ["candidate-review.json", "offline-review.json"],
  },
  "cloud-sandboxes": {
    files: { "task.json": '{"values":[2,3,5],"classification":"synthetic"}\n' },
    outputs: ["sandbox-proof.json", "offline-proof.json"],
  },
  "copilot-memory": {
    files: {
      "normalize-ticket.mjs": 'export const normalizeTicket = (title) => title.trim().toLowerCase().replace(/\\s+/g, "-");\n',
      "convention.md": "# Synthetic repository convention\n\nTicket IDs are lowercase and hyphenated. Evidence: normalize-ticket.mjs:1.\n\nRepository scope only. Do not store user preferences or personal data.\n",
    },
    outputs: ["ticket.json", "offline-ticket.json"],
  },
  "autopilot": {
    files: {
      "discount.mjs": "export function discount(price, percent) {\n  return price - percent;\n}\n",
      "discount.test.mjs": discountTests,
    },
    outputs: [],
  },
};

const catalog = JSON.parse(readFileSync(new URL("../catalog/features.json", import.meta.url), "utf8"));
Object.assign(fixtures, recipeFixtures(catalog.features, fixtures));
