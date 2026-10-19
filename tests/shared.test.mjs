import test from "node:test";
import assert from "node:assert/strict";
import { featureSourceIds, reviewLabel } from "../shared/evidence.mjs";
import { escapeHtml, formatDate, formatUtcTimestamp } from "../shared/text.mjs";

test("source IDs are deduplicated across every feature evidence surface", () => {
  assert.deepEqual(featureSourceIds({
    lifecycle: { source: "lifecycle" }, cost: { sources: ["cost", "lifecycle"] },
    enablement: [{ sources: ["enablement", "cost"] }],
    readiness: [{ sources: ["readiness", "enablement"] }],
  }), ["lifecycle", "cost", "enablement", "readiness"]);
});

test("review labels distinguish human review from automated assessment", () => {
  assert.equal(reviewLabel({ verifiedOn: "2026-10-18" }), "Reviewed 2026-10-18");
  assert.equal(reviewLabel({ verifiedOn: null, provenance: { assessedOn: "2026-10-19" } }, formatDate), "Not human verified (assessed 19 Oct 2026)");
  assert.equal(reviewLabel({ verifiedOn: null }), "Not human verified");
  assert.equal(formatUtcTimestamp("2026-10-19T03:15:15Z"), "19 Oct 2026, 03:15:15");
  assert.equal(escapeHtml(`<tag attr="'">&`), "&lt;tag attr=&quot;&#39;&quot;&gt;&amp;");
});
