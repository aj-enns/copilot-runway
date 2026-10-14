import { XMLParser, XMLValidator } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { fromRoot, readJson, write, isOfficialUrl } from "./lib.mjs";

const maximumBytes = 2_000_000;

export function plainText(value, limit = 600) {
  return String(value ?? "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim().slice(0, limit);
}

export function signalFor(text) {
  if (/\b(public|technical|private)\s+preview\b|\bexperimental\b|\bearly access\b/i.test(text)) return "preview-signal";
  if (/\bgenerally available\b|\bdeprecat(?:ed|ion|ing)\b|\bretir(?:ed|ing|ement)\b|\bsunset\b/i.test(text)) return "lifecycle-signal";
  return "update";
}

export function gaSignalFor(title, body = "") {
  const openingSentence = body.split(/(?<=[.!?])\s+/)[0];
  const text = signalFor(title) === "update" ? openingSentence : title;
  return signalFor(text) === "lifecycle-signal" && /\bgenerally available\b/i.test(text) &&
    !/\b(?:not|no longer|isn't|aren't|won't)\s+(?:yet\s+|be\s+)?generally available\b/i.test(text) &&
    !/\bdeprecat(?:ed|ion|ing)\b|\bretir(?:ed|ing|ement)\b|\bsunset\b/i.test(text);
}

function candidate(feed, title, url, published, summary, signalText, allowedHosts, release = false) {
  const titleText = plainText(title, 240);
  if (typeof title !== "string" || !titleText || !isOfficialUrl(url, allowedHosts)) throw new Error(`${feed.id}: missing title or unapproved item URL`);
  const date = new Date(published);
  if (typeof published !== "string" || !published.trim() || !Number.isFinite(date.valueOf()) ||
    date.valueOf() > Date.now() + 86_400_000) throw new Error(`${feed.id}: invalid publication date`);
  const canonical = new URL(url);
  canonical.hash = "";
  const normalized = canonical.href.replace(/\/$/, "");
  const titleSignal = signalFor(titleText);
  const signal = titleSignal === "update" ? signalFor(signalText) : titleSignal;
  return {
    id: createHash("sha256").update(`${feed.id}:${normalized}`).digest("hex").slice(0, 16),
    feed: feed.id,
    title: titleText,
    url: canonical.href,
    publishedOn: date.toISOString(),
    summary: plainText(summary, 500),
    signal: signal === "update" && release ? "release" : signal,
    gaSignal: !release && gaSignalFor(titleText, signalText),
  };
}

export function parseFeed(feed, body, allowedHosts) {
  if (feed.type === "rss") {
    const validation = XMLValidator.validate(body);
    if (validation !== true || /<!ENTITY/i.test(body)) throw new Error(`${feed.id}: invalid or unsupported RSS XML`);
    const parser = new XMLParser({ ignoreAttributes: true, processEntities: false, htmlEntities: false, parseTagValue: false });
    const document = parser.parse(body);
    const raw = document.rss?.channel?.item;
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (!items.length) throw new Error(`${feed.id}: RSS feed has no items`);
    return items.slice(0, feed.limit).map((item) => {
      const content = item["content:encoded"] ?? item.description ?? "";
      return candidate(feed, item.title, item.link, item.pubDate, item.description ?? content, plainText(content, 40_000), allowedHosts);
    });
  }
  const releases = JSON.parse(body);
  if (!Array.isArray(releases) || !releases.length) throw new Error(`${feed.id}: releases response is empty or not an array`);
  return releases.filter((release) => !release.draft).slice(0, feed.limit).map((release) =>
    candidate(feed, release.name || release.tag_name, release.html_url, release.published_at,
      release.body ?? "", `${release.prerelease ? "experimental " : ""}${release.body ?? ""}`, allowedHosts, true));
}

export async function fetchOfficial(url, allowedHosts, fetcher = fetch) {
  let current = url;
  for (let redirects = 0; redirects <= 4; redirects++) {
    if (!isOfficialUrl(current, allowedHosts)) throw new Error(`Refusing unapproved fetch URL: ${current}`);
    const response = await fetcher(current, {
      redirect: "manual",
      headers: { Accept: "application/json, application/rss+xml, text/xml", "User-Agent": "Copilot-Runway-official-source-monitor/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Missing redirect destination from ${current}`);
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error(`Official source fetch failed: HTTP ${response.status} for ${current}`);
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > maximumBytes) throw new Error(`Source response exceeds ${maximumBytes} bytes`);
    if (!response.body) throw new Error("Source returned no response body");
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maximumBytes) throw new Error(`Source response exceeds ${maximumBytes} bytes`);
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  throw new Error("Too many official-source redirects");
}

export async function scan(watch, fetcher = fetch) {
  const groups = await Promise.all(watch.feeds.map(async (feed) => {
    const body = await fetchOfficial(feed.url, watch.allowedHosts, fetcher);
    return parseFeed(feed, body, watch.allowedHosts);
  }));
  const items = [...new Map(groups.flat().map((item) => [item.id, item])).values()]
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || a.id.localeCompare(b.id));
  return {
    schemaVersion: 1,
    lastSuccessfulScan: new Date().toISOString(),
    coverage: "All configured official feeds fetched successfully. Rolling feed windows are bounded, not exhaustive. Signals require review; no assessment or verification date was changed.",
    feeds: watch.feeds.map((feed, index) => ({ id: feed.id, fetched: groups[index].length, limit: feed.limit })),
    items,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const update = args.includes("--update");
    const outputIndex = args.indexOf("--output");
    const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
    if (!(args.length === 0 || (args.length === 1 && update) ||
      (args.length === 2 && args[0] === "--output" && output && !output.startsWith("--")))) {
      throw new Error("Usage: npm run sources:scan -- [--update | --output PATH]");
    }
    const result = await scan(await readJson(fromRoot("catalog", "watch.json")));
    if (update) await write(fromRoot("catalog", "monitor.json"), `${JSON.stringify(result, null, 2)}\n`);
    else if (output) await write(fromRoot(output), `${JSON.stringify(result, null, 2)}\n`);
    else console.log(JSON.stringify(result, null, 2));
    console.log(`Official-source scan succeeded: ${result.items.length} candidate signals. Feature readiness and last-verified dates are unchanged.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
