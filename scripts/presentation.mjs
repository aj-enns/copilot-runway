import JSZip from "jszip";

// Package timestamps are build metadata, not evidence or verification dates.
const packageDate = new Date("1980-01-01T00:00:00Z");

export async function presentationBytes(deck) {
  const archive = await JSZip.loadAsync(await deck.write({ outputType: "nodebuffer" }));
  const core = archive.file("docProps/core.xml");
  if (!core) throw new Error("Presentation is missing core properties");
  const properties = await core.async("string");
  if (!properties.includes("<dcterms:created ") || !properties.includes("<dcterms:modified ")) {
    throw new Error("Presentation is missing package timestamps");
  }
  archive.file("docProps/core.xml", properties.replace(
    /(<dcterms:(?:created|modified)\b[^>]*>)[^<]*(<\/dcterms:(?:created|modified)>)/g,
    (match, open, close) => `${open}${packageDate.toISOString()}${close}`,
  ));
  for (const entry of Object.values(archive.files)) entry.date = packageDate;
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE", platform: "DOS" });
}
