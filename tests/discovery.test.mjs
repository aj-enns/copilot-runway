import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseFeed, fetchOfficial, scan, signalFor, plainText } from "../scripts/discover.mjs";
import { fromRoot, readJson } from "../scripts/lib.mjs";

const watch = await readJson(fromRoot("catalog", "watch.json"));
const rss = `<?xml version="1.0"?><rss version="2.0"><channel><item>
<title>Computer Use public preview</title><link>https://github.blog/changelog/example/</link>
<pubDate>Tue, 13 Oct 2026 18:39:56 +0000</pubDate>
<description><![CDATA[<p>Review enterprise controls.</p><script>doBadThings()</script>]]></description>
<content:encoded><![CDATA[Public preview; review required.]]></content:encoded>
</item></channel></rss>`;

test("scanner rejects unknown, duplicate, and ambiguous CLI arguments before fetching", () => {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  for (const args of [["--not-an-option"], ["--output"], ["--update", "--update"], ["--output", "--update"], ["--update", "--output", "catalog/monitor.json"]]) {
    const result = spawnSync(process.execPath, [fromRoot("scripts", "discover.mjs"), ...args], {
      env: environment, encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, "");
  }
});

test("official RSS is parsed as inert, bounded candidate metadata", () => {
  const feed = watch.feeds[0];
  const items = parseFeed(feed, rss, watch.allowedHosts);
  assert.equal(items.length, 1);
  assert.equal(items[0].signal, "preview-signal");
  assert.equal(items[0].summary, "Review enterprise controls.");
  assert.equal(items[0].id.length, 16);
  assert.equal(items[0].publishedOn, "2026-10-13T18:39:56.000Z");
});

test("release, preview, GA, and retirement signals remain distinct", () => {
  const feed = watch.feeds[1];
  const body = JSON.stringify([
    { name: "v1", html_url: "https://github.com/github/copilot-cli/releases/tag/v1", published_at: "2026-10-13T00:00:00Z", body: "Bug fixes" },
    { name: "v2", html_url: "https://github.com/github/copilot-cli/releases/tag/v2", published_at: "2026-10-13T00:00:00Z", body: "Experimental workflow API", prerelease: true },
    { name: "draft", draft: true },
  ]);
  assert.deepEqual(parseFeed(feed, body, watch.allowedHosts).map((item) => item.signal), ["release", "preview-signal"]);
  assert.equal(signalFor("Feature is generally available"), "lifecycle-signal");
  assert.equal(signalFor("Retired compiler version"), "lifecycle-signal");
  assert.equal(signalFor("Updated policy"), "update");
});

test("headline lifecycle signals take precedence over historical preview language in the body", () => {
  const titleOnly = rss.replace("Public preview; review required.", "Review required.");
  assert.equal(parseFeed(watch.feeds[0], titleOnly, watch.allowedHosts)[0].signal, "preview-signal");
  const graduation = rss.replace("Computer Use public preview", "Computer Use is generally available");
  assert.equal(parseFeed(watch.feeds[0], graduation, watch.allowedHosts)[0].signal, "lifecycle-signal");
});

test("malformed XML, missing dates, empty releases, external links, and entity declarations fail", () => {
  const feed = watch.feeds[0];
  assert.throws(() => parseFeed(feed, "<rss><unclosed>", watch.allowedHosts), /invalid/);
  assert.throws(() => parseFeed(feed, rss.replace("Tue, 13 Oct 2026 18:39:56 +0000", "not a date"), watch.allowedHosts), /invalid publication/);
  assert.throws(() => parseFeed(feed, rss.replace("https://github.blog/changelog/example/", "https://untrusted.invalid/page"), watch.allowedHosts), /unapproved item URL/);
  assert.throws(() => parseFeed(feed, '<!DOCTYPE rss [<!ENTITY x "attack">]>' + rss, watch.allowedHosts), /invalid or unsupported/);
  assert.throws(() => parseFeed(watch.feeds[1], "[]", watch.allowedHosts), /empty or not an array/);
  const invalidDate = JSON.stringify([{ name: "v1", html_url: "https://github.com/github/copilot-cli/releases/tag/v1", published_at: null }]);
  assert.throws(() => parseFeed(watch.feeds[1], invalidDate, watch.allowedHosts), /invalid publication/);
});

test("fetcher refuses unapproved redirects without sending a credential", async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    return new Response(null, { status: 302, headers: { Location: "https://attacker.invalid/feed" } });
  };
  await assert.rejects(fetchOfficial(watch.feeds[0].url, watch.allowedHosts, fetcher), /unapproved fetch URL/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.Authorization, undefined);
});

test("fetch failures and oversized responses are explicit, never an empty successful scan", async () => {
  await assert.rejects(fetchOfficial(watch.feeds[0].url, watch.allowedHosts, async () => new Response("error", { status: 503 })), /HTTP 503/);
  await assert.rejects(fetchOfficial(watch.feeds[0].url, watch.allowedHosts, async () => new Response("x", { headers: { "content-length": "3000000" } })), /exceeds/);
  await assert.rejects(scan({ ...watch, feeds: [watch.feeds[0]] }, async () => new Response("error", { status: 500 })), /HTTP 500/);
});

test("successful scan has bounded metadata without changing verification dates", async () => {
  const oneFeed = { ...watch, feeds: [watch.feeds[0]] };
  const result = await scan(oneFeed, async () => new Response(rss));
  assert.equal(result.items.length, 1);
  assert.equal(result.feeds[0].fetched, 1);
  assert.ok(result.lastSuccessfulScan);
  assert.match(result.coverage, /no assessment or verification date was changed/);
  assert.equal(result.verifiedOn, undefined);
});

test("HTML and source prose are flattened, not evaluated or injected", () => {
  assert.equal(plainText('<style>x</style><p>Hello &amp; goodbye</p><script>alert(1)</script>'), "Hello & goodbye");
  assert.equal(plainText("a".repeat(700)).length, 600);
});
