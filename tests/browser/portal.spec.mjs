import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const site = resolve(fileURLToPath(new URL("../../", import.meta.url)), "dist", "index.html");

test("flight deck renders, filters, links assets, and emits no browser/CSP errors", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/?clawpilotTheme=light");
  await expect(page.getByRole("heading", { name: /From preview to/ })).toBeVisible();
  await expect(page.locator(".feature-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Public preview", exact: true }).click();
  await expect(page.locator(".feature-card")).toHaveCount(3);
  await page.getByRole("button", { name: "All capabilities", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search capabilities" }).fill("dynamic");
  await expect(page.locator(".feature-card")).toHaveCount(1);
  await expect(page.locator(".feature-card")).toContainText("Hold for evidence");
  await page.getByRole("searchbox", { name: "Search capabilities" }).fill("no-match-for-this");
  await expect(page.getByRole("heading", { name: "No capabilities match those filters." })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".feature-card")).toHaveCount(6);
  for (const path of ["/runbooks/computer-use.md", "/assessments/dynamic-workflows.md", "/artifacts/slides/copilot-runway.pptx", "/assets/copilot.svg", "/THIRD_PARTY_NOTICES.md"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
  expect((await request.get("/not-present")).status()).toBe(404);
  expect(errors).toEqual([]);
  await page.goto("/?clawpilotTheme=light");
  await expect(page.locator(".feature-card")).toHaveCount(6);
  await page.screenshot({ path: "test-results/flight-deck-desktop.png", fullPage: true });
});

test("feature details support direct links, all gates, keyboard tabs, downloads, and Escape", async ({ page }) => {
  await page.goto("/?clawpilotTheme=light#feature=dynamic-workflows&tab=readiness");
  const dialog = page.getByRole("dialog", { name: "Dynamic Workflows", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("row")).toHaveCount(11);
  await expect(dialog).toContainText("unknown");
  await dialog.getByRole("tab", { name: "Readiness", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: "Demo", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog).toContainText("live feature validation: not-run");
  const download = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Download full runbook (.md)" }).click();
  expect((await download).suggestedFilename()).toBe("dynamic-workflows.md");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("featured kit links open the real assessment, presenter kit, and sourced deck", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?clawpilotTheme=light");
  const kit = page.getByRole("region", { name: "Featured enablement kit" });
  await expect(kit).toContainText("Kit: kit-tested");
  await expect(kit).toContainText("Live: not-run");
  await kit.getByRole("button", { name: /Enterprise assessment/ }).click();
  const dialog = page.getByRole("dialog", { name: "Computer Use", exact: true });
  await expect(dialog.getByRole("tab", { name: "Readiness", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("row")).toHaveCount(11);
  await dialog.getByRole("button", { name: "Close feature" }).click();
  await kit.getByRole("button", { name: /Presenter runbook/ }).click();
  await expect(dialog.getByRole("tab", { name: "Demo", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog).toContainText("live feature validation: not-run");
  await dialog.getByRole("button", { name: "Close feature" }).click();
  const download = page.waitForEvent("download");
  await kit.getByRole("link", { name: /Value & cost brief/ }).click();
  expect((await download).suggestedFilename()).toBe("computer-use.pptx");
});

test("workspace navigation, keyboard search, and theme controls expose their current state", async ({ page }) => {
  await page.goto("/?clawpilotTheme=light");
  const navigation = page.getByRole("navigation", { name: "Primary" });
  const theme = page.getByRole("button", { name: "Switch color theme", exact: true });
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await expect(theme).toHaveAttribute("title", "Switch to dark theme");
  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(theme).toHaveAttribute("title", "Switch to light theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await navigation.getByRole("button", { name: "Cost lab", exact: true }).click();
  await expect(navigation.getByRole("button", { name: "Cost lab", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(navigation.locator("[aria-current=page]")).toHaveCount(1);
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "Search capabilities" })).toBeFocused();
  await page.getByRole("searchbox", { name: "Search capabilities" }).fill("cloud sandboxes");
  await expect(page.locator(".feature-card")).toHaveCount(1);
  await expect(page.locator(".feature-title")).toHaveText("Cloud Sandboxes");
});

for (const width of [320, 768, 1100, 1440]) {
  test(`workspace and all five views fit a ${width}px viewport in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    for (const theme of ["light", "dark"]) {
      await page.goto(`/?clawpilotTheme=${theme}`);
      for (const view of ["catalog", "readiness", "demos", "cost", "radar"]) {
        await page.locator(`.nav-button[data-view="${view}"]`).click();
        await expect(page.locator(`#view-${view}`)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${view} overflows`).toBe(true);
      }
    }
  });
}

test("comparison preserves experimental/public/technical distinctions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Compare Dynamic Workflows", exact: true }).click();
  await page.getByRole("button", { name: "Compare GitHub Agentic Workflows", exact: true }).click();
  await page.getByRole("button", { name: "Compare capabilities", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Compare the evidence" });
  await expect(dialog).toContainText("Experimental");
  await expect(dialog).toContainText("Technical preview");
  await expect(dialog).toContainText("Hold for evidence");
  await dialog.getByRole("button", { name: "Close comparison" }).click();
  await page.getByRole("button", { name: "Clear comparison", exact: true }).click();
  await expect(page.locator("#compare-rail")).not.toBeVisible();
});

test("local policy additions persist and export without becoming canonical findings or markup", async ({ page }) => {
  await page.goto("/#view=readiness");
  await expect(page.locator(".gate-card")).toHaveCount(10);
  await page.getByLabel("Requirement", { exact: true }).fill("<img src=x onerror=alert(1)> Approved log retention");
  await page.getByRole("button", { name: "Add requirement", exact: true }).click();
  await expect(page.locator(".local-rule")).toHaveCount(1);
  await expect(page.locator(".local-rule img")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".local-rule")).toContainText("Approved log retention");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export proposed policy (.json)" }).click();
  const path = await (await download).path();
  const policy = JSON.parse(await readFile(path, "utf8"));
  expect(policy.classification).toBe("proposed-workshop-policy");
  expect(policy.gates).toHaveLength(11);
  await page.getByRole("button", { name: /Remove local requirement/ }).click();
  await expect(page.locator(".local-rule")).toHaveCount(0);
  await expect(page.locator(".gate-card")).toHaveCount(10);
});

test("demo rehearsal can progress, stop, reset, and never claims a live run", async ({ page }) => {
  await page.goto("/#view=demos");
  await expect(page.getByText("Interactive rehearsal, not a live Copilot run.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dynamic Workflows 10-min live runbook" }).click();
  await page.getByRole("button", { name: "Inspect synthetic context" }).click();
  await page.getByRole("button", { name: "Approve local rehearsal" }).click();
  await expect(page.locator("#demo-lab")).toContainText("BLOCKED: missing audit");
  await page.getByRole("button", { name: "Verify fixture story" }).click();
  await expect(page.locator("#demo-lab")).toContainText("Rehearsal checked");
  await page.getByRole("button", { name: "Reset rehearsal" }).click();
  await expect(page.locator("#demo-lab")).toContainText("audit NO");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator("#demo-lab")).toContainText("no external action occurred");
  await expect(page.locator("#demo-lab")).not.toContainText("Live verified");
});

test("cost lab enforces blank/invalid input and exact cloud-meter assumptions", async ({ page }) => {
  await page.goto("/#view=cost");
  await expect(page.locator(".cost-total")).toHaveText("$1.0698");
  await page.getByLabel("Chargeable AI credits").fill("0");
  await page.getByLabel("Cloud running time (minutes)").fill("60");
  await page.getByLabel("Snapshot storage (GiB)").fill("0");
  await expect(page.locator(".cost-total")).toHaveText("$0.1296");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export assumptions (.md)" }).click();
  const scenario = await readFile(await (await download).path(), "utf8");
  expect(scenario).toContain("$0.1296");
  expect(scenario).toContain("approved billable owner");
  expect(scenario).toContain("separate from bundled AI-credit budgets");
  await page.getByLabel("Chargeable AI credits").fill("");
  await expect(page.locator("#cost-result")).toContainText("blank values are not zero");
  await expect(page.getByRole("button", { name: "Export assumptions (.md)" })).toBeDisabled();
});

test("mobile layout, dark theme, and reduced motion remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?clawpilotTheme=dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".feature-card")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-feature="computer-use"] .feature-title').click();
  await expect(page.getByRole("dialog", { name: "Computer Use", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close feature" }).click();
  await page.getByRole("button", { name: "Switch color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "test-results/flight-deck-mobile.png", fullPage: true });
});

test("stale evidence blocks all required verdicts, even when the source scan is recent", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-20T12:00:00Z") });
  await page.goto("/");
  await expect(page.locator("#global-warning")).toContainText("past the 30-day evidence window");
  await expect(page.locator(".card-readiness strong")).toHaveText(Array(6).fill("Hold for evidence"));
  await expect(page.locator("#hero-kit")).toContainText("Hold for evidence");
});

test("a stale underlying source blocks current-looking feature assessments and surfaces a warning", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") });
  let document = await readFile(site, "utf8");
  const match = document.match(/<script type="application\/json" id="runway-data">([\s\S]*?)<\/script>/);
  const catalog = JSON.parse(match[1]);
  catalog.sources.billing.verifiedOn = "2026-09-01";
  document = document.replace(match[1], () => JSON.stringify(catalog).replace(/</g, "\\u003c"));
  await page.route("http://127.0.0.1:4173/", (route) => route.fulfill({ contentType: "text/html", body: document }));
  await page.goto("/");
  await expect(page.locator("#global-warning")).toContainText("or their sources");
  await expect(page.locator(".card-readiness strong")).toHaveText(Array(6).fill("Hold for evidence"));
  await expect(page.locator(".card-readiness small")).toHaveText(Array(6).fill("Re-review overdue"));
});

test("built portal works from a file URL without any network dependency", async ({ page }) => {
  const network = [];
  page.on("request", (request) => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(site).href + "?clawpilotTheme=light");
  await expect(page.locator(".feature-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Experimental", exact: true }).click();
  await expect(page.locator(".feature-card")).toHaveCount(2);
  expect(network).toEqual([]);
});
