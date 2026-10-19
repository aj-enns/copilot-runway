import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { presentationBytes } from "../scripts/presentation.mjs";

function deck(timestamp, content = "Synthetic slide content") {
  return { write: async () => {
    const zip = new JSZip();
    zip.file("docProps/core.xml", `<cp:coreProperties><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`, { date: new Date(timestamp) });
    zip.file("ppt/slides/slide1.xml", content, { date: new Date(timestamp) });
    return zip.generateAsync({ type: "nodebuffer" });
  } };
}

test("presentation bytes ignore package timestamps but preserve content changes", async () => {
  const first = await presentationBytes(deck("2026-10-18T12:00:00Z"));
  const second = await presentationBytes(deck("2026-10-19T12:00:00Z"));
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, await presentationBytes(deck("2026-10-19T12:00:00Z", "Updated template content")));
  const archive = await JSZip.loadAsync(first);
  assert.equal(await archive.file("ppt/slides/slide1.xml").async("string"), "Synthetic slide content");
  assert.match(await archive.file("docProps/core.xml").async("string"), /1980-01-01T00:00:00.000Z/);
});
