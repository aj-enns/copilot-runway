import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const site = resolve(fileURLToPath(new URL("../../", import.meta.url)), "dist", "index.html");
const catalog = JSON.parse(await readFile(new URL("../../catalog/features.json", import.meta.url), "utf8"));

async function checkCopyButtons(scope, page) {
  for (const button of await scope.locator("[data-copy]").all()) {
    const command = await button.getAttribute("data-copy");
    await button.click();
    await expect(page.locator("#toast")).toContainText("Copied.");
    expect(await page.evaluate(() => window.runwayCopiedCommands.at(-1))).toBe(command);
  }
}

test("all feature illustrations render in both themes, open details, and download as self-contained SVG", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.goto(`/?clawpilotTheme=${theme}`);
    await expect(page.locator(".feature-cover .feature-art")).toHaveCount(6);
    for (const feature of catalog.features) {
      await page.getByRole("button", { name: `Open illustrated overview of ${feature.name}`, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: feature.name, exact: true });
      await expect(dialog.locator(".feature-story .feature-art")).toBeVisible();
      await expect(dialog.locator(".feature-story")).toContainText("not a product screenshot or live run");
      if (theme === "light") {
        const downloaded = page.waitForEvent("download");
        await dialog.getByRole("link", { name: "Download feature visual (.svg)" }).click();
        const artifact = await downloaded;
        expect(artifact.suggestedFilename()).toBe(`${feature.id}.svg`);
        const svg = await readFile(await artifact.path(), "utf8");
        expect(svg).toContain("<style>:root");
        expect(svg).toContain(feature.name);
        expect(svg).not.toMatch(/<script|<foreignObject|<image|\son\w+=/i);
      }
      await dialog.getByRole("button", { name: "Close feature" }).click();
    }
  }
});

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
  await expect(page.getByRole("searchbox", { name: "Search capabilities" })).toBeFocused();
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

test("brand color accents remain visible and readable in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.goto(`/?clawpilotTheme=${theme}`);
    const colors = await page.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector));
      return {
        header: style(".topbar").backgroundColor,
        headerText: style(".breadcrumb strong").color,
        surface: style(".feature-card").backgroundColor,
        hero: style(".hero").backgroundImage,
        blue: style('[data-feature="computer-use"] .feature-cover').borderBottomColor,
        rose: style('[data-feature="dynamic-workflows"] .feature-cover').borderBottomColor,
        metrics: style(".metric").backgroundColor,
      };
    });
    expect(colors.header).not.toBe(colors.headerText);
    expect(colors.hero).toContain("linear-gradient");
    expect(colors.blue).not.toBe(colors.rose);
    expect(colors.metrics).not.toBe(colors.surface);
    await expect(page.locator('[data-feature="computer-use"] .feature-art')).toBeVisible();
  }
});

test("start links, home navigation, Radar shortcuts, and shared downloads work", async ({ page }) => {
  await page.goto("/?clawpilotTheme=light");
  await expect(page.locator(".repo-identity a")).toHaveText("aj-enns/copilot-runway");
  await expect(page.locator(".repo-identity a")).toHaveAttribute("href",
    "https://github.com/aj-enns/copilot-runway");
  await page.getByRole("button", { name: "Start with Computer Use", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Computer Use", exact: true });
  await expect(dialog.getByRole("tab", { name: "Demo", exact: true })).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("button", { name: "Close feature" }).click();
  for (const [name, filename] of [
    ["Architect brief", "copilot-runway.pptx"],
    [/Read the assessment policy/, "README.md"],
    [/Branding & attribution/, "THIRD_PARTY_NOTICES.md"],
  ]) {
    const downloaded = page.waitForEvent("download");
    await page.getByRole("link", { name }).click();
    expect((await downloaded).suggestedFilename()).toBe(filename);
  }
  await expect(page.getByRole("link", { name: "Suggest a feature" })).toHaveAttribute("href",
    "https://github.com/aj-enns/copilot-runway/issues/new?template=feature-request.yml");
  await expect(page.getByRole("link", { name: /Open repository/ })).toHaveAttribute("href",
    "https://github.com/aj-enns/copilot-runway");
  await page.getByRole("button", { name: /See what's on radar/ }).click();
  await expect(page.locator("#view-radar")).toBeVisible();
  await page.getByRole("link", { name: "Copilot Runway home" }).click();
  await expect(page.locator("#view-catalog")).toBeVisible();
  await page.locator(".nav-button[data-view=ga]").click();
  await page.getByRole("button", { name: "Open official-source Radar" }).click();
  await expect(page.locator("#view-radar")).toBeVisible();
});

test("release, readiness, surface, and search filters compose and reset together", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") });
  await page.goto("/");
  await page.getByRole("button", { name: "Technical preview", exact: true }).click();
  await expect(page.locator(".feature-title")).toHaveText(["GitHub Agentic Workflows"]);
  await page.getByRole("button", { name: "All capabilities", exact: true }).click();
  await page.getByLabel("Filter by readiness").selectOption("blocked");
  await expect(page.locator(".feature-title")).toHaveText(["Dynamic Workflows"]);
  await page.getByRole("button", { name: "Experimental", exact: true }).click();
  await page.getByLabel("Filter by surface").selectOption("Copilot SDK");
  await expect(page.locator(".feature-title")).toHaveText(["Dynamic Workflows"]);
  await page.getByRole("searchbox", { name: "Search capabilities" }).fill("legacy support records");
  await expect(page.locator(".feature-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".feature-card")).toHaveCount(6);
  await expect(page.getByLabel("Filter by readiness")).toHaveValue("");
  await expect(page.getByLabel("Filter by surface")).toHaveValue("");
  await expect(page.getByRole("searchbox", { name: "Search capabilities" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "All capabilities", exact: true })).toHaveAttribute("aria-pressed", "true");
});

for (const feature of catalog.features) {
  test(`every feature action and rehearsal control works for ${feature.name}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.runwayCopiedCommands = [];
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (command) => { window.runwayCopiedCommands.push(command); } },
      });
    });
    await page.goto("/");
    const card = page.locator(`[data-feature="${feature.id}"]`);
    await card.getByRole("button", { name: "Assess", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: feature.name, exact: true });
    await expect(dialog.getByRole("row")).toHaveCount(11);
    const assessment = page.waitForEvent("download");
    await dialog.getByRole("link", { name: "Download assessment (.md)" }).click();
    expect((await assessment).suggestedFilename()).toBe(`${feature.id}.md`);
    await dialog.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(dialog.locator(".enterprise-uses li")).toHaveText(catalog.enterpriseUseCases[feature.id]);
    await checkCopyButtons(dialog, page);
    await dialog.getByRole("tab", { name: "Sources", exact: true }).click();
    await expect(dialog.locator(".evidence-source")).not.toHaveCount(0);
    for (const link of await dialog.locator(".evidence-source a").all()) {
      const url = new URL(await link.getAttribute("href"));
      expect(url.protocol).toBe("https:");
      expect(["github.com", "docs.github.com", "github.blog", "github.github.io"]).toContain(url.hostname);
    }
    await dialog.getByRole("tab", { name: "Readiness", exact: true }).click();
    await dialog.getByRole("button", { name: "Explore the non-negotiables" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("#view-readiness")).toBeVisible();
    await expect(page.getByRole("link", { name: "Propose a policy change" })).toHaveAttribute("href",
      "https://github.com/aj-enns/copilot-runway/edit/main/readiness/gates.json");
    await page.locator(".nav-button[data-view=catalog]").click();
    await card.getByRole("button", { name: "Demo", exact: true }).click();
    await expect(dialog.getByRole("tab", { name: "Demo", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.locator(".lab-illustration .feature-art")).toBeVisible();
    await checkCopyButtons(dialog, page);
    const runbook = page.waitForEvent("download");
    await dialog.getByRole("link", { name: "Download full runbook (.md)" }).click();
    expect((await runbook).suggestedFilename()).toBe(`${feature.id}.md`);
    await dialog.locator(".runbook-full summary").click();
    await expect(dialog.locator(".runbook-full pre")).toBeVisible();
    await dialog.getByRole("button", { name: "Open offline rehearsal" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("#view-demos")).toBeVisible();
    await expect(page.locator(`.demo-choice[data-lab="${feature.id}"]`)).toHaveAttribute("aria-pressed", "true");
    await checkCopyButtons(page.locator("#demo-lab"), page);
    await page.getByRole("button", { name: "Inspect synthetic context" }).click();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.locator("#lab-advance")).toBeDisabled();
    await page.getByRole("button", { name: "Reset rehearsal" }).click();
    await page.getByRole("button", { name: "Inspect synthetic context" }).click();
    await page.getByRole("button", { name: "Approve local rehearsal" }).click();
    await page.getByRole("button", { name: "Verify fixture story" }).click();
    await expect(page.locator("#demo-lab")).toContainText("Rehearsal checked");
    await expect(page.locator("#lab-advance")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Reset rehearsal" }).click();
    await expect(page.locator("#lab-advance")).toBeEnabled();
    await page.getByRole("button", { name: "Open full presenter kit" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("live feature validation: not-run");
    await dialog.getByRole("button", { name: "Close feature" }).click();
    await page.locator(".nav-button[data-view=catalog]").click();
    const slides = page.waitForEvent("download");
    await card.getByRole("link", { name: `Download ${feature.name} slides` }).click();
    expect((await slides).suggestedFilename()).toBe(`${feature.id}.pptx`);
    expect(errors).toEqual([]);
  });
}

test("copy controls surface denied clipboard access without claiming success", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => { throw new DOMException("Clipboard denied", "NotAllowedError"); } },
    });
  });
  await page.goto("/#view=demos");
  await page.locator("#demo-lab").getByRole("button", { name: "Copy command" }).click();
  await expect(page.locator("#toast")).toContainText("Clipboard access is unavailable");
  await expect(page.locator("#toast")).not.toContainText("Copied.");
});

test("comparison limits, selection toggles, opening, and clearing remain coherent", async ({ page }) => {
  await page.goto("/");
  const selection = catalog.features.slice(0, 4);
  await page.getByRole("button", { name: `Compare ${selection[0].name}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Compare capabilities", exact: true })).toBeDisabled();
  for (const feature of selection.slice(1, 3)) await page.getByRole("button", { name: `Compare ${feature.name}`, exact: true }).click();
  await page.getByRole("button", { name: `Compare ${selection[3].name}`, exact: true }).click();
  await expect(page.locator("#toast")).toContainText("Compare up to three capabilities");
  await expect(page.getByRole("button", { name: `Compare ${selection[3].name}`, exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: `Compare ${selection[1].name}`, exact: true }).click();
  await page.getByRole("button", { name: `Compare ${selection[3].name}`, exact: true }).click();
  await page.getByRole("button", { name: "Compare capabilities", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Compare the evidence" });
  await expect(dialog.getByRole("columnheader")).toHaveCount(4);
  await dialog.getByRole("button", { name: "Close comparison" }).click();
  await page.getByRole("button", { name: "Clear comparison", exact: true }).click();
  await expect(page.locator("#compare-rail")).not.toBeVisible();
  await expect(page.locator(".compare-toggle[aria-pressed=true]")).toHaveCount(0);
});

for (const width of [320, 768, 1100, 1440]) {
  test(`workspace and all seven views fit a ${width}px viewport in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    for (const theme of ["light", "dark"]) {
      await page.goto(`/?clawpilotTheme=${theme}`);
      for (const view of ["catalog", "context", "readiness", "demos", "cost", "radar", "ga"]) {
        await page.locator(`.nav-button[data-view="${view}"]`).click();
        await expect(page.locator(`#view-${view}`)).toBeVisible();
        if (view === "context") await page.getByRole("button", { name: "Preview sample account matches" }).click();
        if (view === "demos") await page.getByRole("button", { name: "Build recording brief" }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${view} overflows`).toBe(true);
      }
    }
  });
}

test("account context shows fictional matches, private handoff, and no connected data or persistence", async ({ page, request }) => {
  const externalRequests = [];
  const errors = [];
  page.on("request", (r) => { if (new URL(r.url()).hostname !== "127.0.0.1") externalRequests.push(r.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.runwayCopiedCommands = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (command) => { window.runwayCopiedCommands.push(command); } } });
  });
  await page.goto("/?clawpilotTheme=light");
  await page.getByRole("button", { name: /Pull your account context/ }).click();
  await expect(page.locator("#view-context")).toBeVisible();
  await expect(page.locator("#view-context")).toContainText("WorkIQ is not connected");
  await expect(page.locator(".account-match")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview sample account matches" }).click();
  await expect(page.locator(".account-match")).toHaveCount(3);
  await expect(page.locator(".account-feature-match")).toHaveCount(6);
  await expect(page.locator("#context-status")).toContainText("no real data was retrieved");
  await page.getByLabel("Planned lookback").selectOption("7");
  await expect(page.locator("#workiq-handoff")).toContainText("last 7 days");
  await page.getByRole("button", { name: "Copy private WorkIQ handoff prompt" }).click();
  const copied = await page.evaluate(() => window.runwayCopiedCommands.at(-1));
  expect(copied).toContain("last 7 days");
  expect(copied).toContain("Do not upload account context");
  expect(copied).toContain("Current pilot verdict: Hold for evidence");
  for (const feature of catalog.features) {
    await page.getByRole("button", { name: `Inspect ${feature.name}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: feature.name, exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close feature" }).click();
    await expect(page.locator("#view-context")).toBeVisible();
  }
  await page.getByText("How authentication would work", { exact: true }).click();
  await expect(page.locator(".connector-card")).toContainText("GitHub sign-in does not grant Microsoft 365 access");
  expect((await request.get("/docs/integration-vision.md")).status()).toBe(200);
  await page.screenshot({ path: "test-results/account-context.png", fullPage: true });
  await page.getByRole("button", { name: "Clear sample context" }).click();
  await expect(page.locator(".account-match")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview sample account matches" })).toBeFocused();
  await page.getByRole("button", { name: "Preview sample account matches" }).click();
  await page.reload();
  await expect(page.locator(".account-match")).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("account scenario fit never overrides stale readiness evidence", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-20T12:00:00Z") });
  await page.goto("/#view=context");
  await page.getByRole("button", { name: "Preview sample account matches" }).click();
  await expect(page.locator(".account-feature-match .badge-blocked")).toHaveCount(6);
  await expect(page.locator("#workiq-handoff")).not.toContainText("Current pilot verdict: Pilot with conditions");
});

test("every demo has illustrated instructions and a correctly scoped, invalidatable recording brief", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.runwayCopiedCommands = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (command) => { window.runwayCopiedCommands.push(command); } } });
  });
  await page.goto("/#view=demos");
  const studio = page.locator("#demo-studio");
  for (const feature of catalog.features) {
    await page.locator(`.demo-choice[data-lab="${feature.id}"]`).click();
    await expect(page.locator("#demo-lab .lab-illustration .feature-art")).toHaveCount(1);
    await expect(studio.getByRole("heading", { name: `How to demo ${feature.name}`, exact: true })).toBeVisible();
    await expect(studio.locator(".demo-step-art")).toHaveCount(4);
    await checkCopyButtons(studio, page);
    await expect(studio.getByRole("button", { name: "Generate video (backend planned)" })).toBeDisabled();
    await expect(studio.getByRole("button", { name: "Download recording brief (.md)" })).toBeDisabled();
    await studio.getByLabel("Target video length").selectOption("180");
    await studio.getByRole("button", { name: "Build recording brief" }).click();
    await expect(studio.locator(".video-timeline > div")).toHaveCount(4);
    await expect(studio.locator("#video-brief-content")).toContainText("Target length: 180 seconds");
    await expect(studio.locator("#video-brief-content")).toContainText("3:00");
    const downloaded = page.waitForEvent("download");
    await studio.getByRole("button", { name: "Download recording brief (.md)" }).click();
    const artifact = await downloaded;
    expect(artifact.suggestedFilename()).toBe(`runway-${feature.id}-recording-brief.md`);
    const brief = await readFile(await artifact.path(), "utf8");
    expect(brief).toContain(`recording brief: ${feature.name}`);
    expect(brief).toContain(`npm run demo:setup -- ${feature.id}`);
    expect(brief).toContain(feature.demo.expected);
    expect(brief).toContain(feature.demo.remoteCleanup);
    expect(brief).toContain("PLANNED ONLY");
    expect(brief).toContain("No video, Copilot run, WorkIQ query");
    await studio.getByLabel("Target video length").selectOption("90");
    await expect(studio.locator("#video-brief")).not.toBeVisible();
    await expect(studio.getByRole("button", { name: "Download recording brief (.md)" })).toBeDisabled();
    await studio.getByRole("button", { name: "Build recording brief" }).click();
    await expect(studio.locator("#video-brief-content")).toContainText("Target length: 90 seconds");
    await expect(studio.locator("#video-brief-content")).toContainText("1:30");
  }
  expect(errors).toEqual([]);
});

test("recording planning preserves rehearsal behavior and never dispatches external work", async ({ page }) => {
  const externalRequests = [];
  page.on("request", (r) => { if (new URL(r.url()).hostname !== "127.0.0.1") externalRequests.push(r.url()); });
  await page.goto("/?clawpilotTheme=light#view=demos");
  await page.getByRole("button", { name: "Jump to illustrated guide" }).click();
  await expect(page.locator("#demo-studio-title")).toBeFocused();
  await page.getByRole("button", { name: "Plan a demo video", exact: true }).click();
  await expect(page.locator("#video-planner-title")).toBeFocused();
  await page.getByRole("button", { name: "Build recording brief" }).click();
  await page.locator("#lab-advance").click();
  await expect(page.locator("#video-brief-content")).toContainText("recording brief: Computer Use");
  await page.locator("#lab-stop").click();
  await page.locator("#lab-reset").click();
  await expect(page.locator("#video-brief")).toBeVisible();
  await page.screenshot({ path: "test-results/demo-studio.png", fullPage: true });
  await page.locator('.demo-choice[data-lab="dynamic-workflows"]').click();
  await expect(page.locator("#video-brief")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Generate video (backend planned)" })).toBeDisabled();
  expect(externalRequests).toEqual([]);
});

test("concise enterprise use cases appear in every card, detail view, and search", async ({ page }) => {
  await page.goto("/?clawpilotTheme=light");
  const cards = page.locator(".feature-card");
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    await expect(card.locator(".enterprise-uses li")).toHaveCount(3);
    await expect(card).toContainText("Potential enterprise uses");
    await card.locator(".feature-title").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".enterprise-uses li")).toHaveCount(3);
    await expect(dialog).toContainText("not verified customer deployments");
    await dialog.getByRole("button", { name: "Close feature" }).click();
  }
  await page.getByRole("searchbox", { name: "Search capabilities" }).fill("legacy support records");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("Computer Use");
});

test("Recently GA has reviewed dates, official links, feature/model filters, and separate preview status", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") });
  await page.goto("/?clawpilotTheme=light#view=ga");
  await expect(page.locator("#view-ga")).toBeVisible();
  await expect(page.locator(".nav-button[data-view=ga]")).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".ga-card")).toHaveCount(3);
  await expect(page.locator(".ga-card h2")).toHaveText(["Gemini 4 Argon", "Claude Haiku 5.5", "Local sandboxing"]);
  await expect(page.locator("[data-ga=gemini-4-argon] time")).toHaveAttribute("datetime", "2026-10-13");
  await expect(page.locator("[data-ga=local-sandboxing] time")).toHaveAttribute("datetime", "2026-10-07");
  await expect(page.locator("#view-ga")).toContainText("GA does not mean enterprise-ready");
  await expect(page.locator("#ga-coverage")).toContainText("not exhaustive coverage");
  for (const link of await page.locator(".ga-card a").all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\/github\.blog\/changelog\/2026-10-/);
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await page.getByLabel("Announcement type").selectOption("feature");
  await expect(page.locator(".ga-card")).toHaveCount(1);
  await expect(page.locator(".ga-card")).toContainText("not GA for hosted Cloud Sandboxes");
  await page.getByLabel("Announcement type").selectOption("model");
  await expect(page.locator(".ga-card")).toHaveCount(2);
  await expect(page.locator(".ga-card .category-label")).toHaveText(["Model availability", "Model availability"]);
  await page.locator(".nav-button[data-view=catalog]").click();
  await expect(page.locator("[data-feature=cloud-sandboxes] .badge-preview")).toHaveText("Public preview");
  await expect(page.locator(".feature-card")).toHaveCount(6);
  expect(errors).toEqual([]);
});

test("GA history survives the recent window and explains an empty filtered result", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-03-01T12:00:00Z") });
  await page.goto("/?clawpilotTheme=dark#view=ga");
  await expect(page.locator(".ga-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No reviewed GA announcements match these filters." })).toBeVisible();
  await expect(page.locator("#view-ga")).toContainText("not evidence that no feature went GA");
  await page.getByLabel("Announcement window").selectOption("0");
  await expect(page.locator(".ga-card")).toHaveCount(3);
  await page.getByLabel("Announcement type").selectOption("feature");
  await expect(page.locator(".ga-card")).toHaveCount(1);
  await page.getByLabel("Announcement window").selectOption("30");
  await expect(page.locator(".ga-card")).toHaveCount(0);
});

test("unreviewed GA signals are escaped and deduplicated without entering reviewed history", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") });
  let document = await readFile(site, "utf8");
  const match = document.match(/<script type="application\/json" id="runway-data">([\s\S]*?)<\/script>/);
  const catalog = JSON.parse(match[1]);
  const pending = { id: "pending", feed: "copilot-changelog", title: "New GA signal <img src=x onerror=alert(1)>",
    url: "https://github.blog/changelog/pending/", publishedOn: "2026-10-14T00:00:00Z", signal: "lifecycle-signal", gaSignal: true };
  catalog.monitor.items = [
    pending, { ...pending, id: "alias", url: pending.url + "?utm_source=feed#details" },
    { ...pending, id: "reviewed", url: catalog.sources["local-sandbox-ga"].url + "#details" },
    { ...pending, id: "retired", url: "https://github.blog/changelog/retired/", gaSignal: false },
    { ...pending, id: "release", feed: "copilot-cli-releases" },
  ];
  document = document.replace(match[1], () => JSON.stringify(catalog).replace(/</g, "\\u003c"));
  await page.route("http://127.0.0.1:4173/", (route) => route.fulfill({ contentType: "text/html", body: document }));
  await page.goto("/#view=ga");
  await expect(page.locator("#ga-pending")).toBeVisible();
  await expect(page.locator(".ga-pending-item")).toHaveCount(1);
  await expect(page.locator(".ga-pending-item")).toContainText("Review pending");
  await expect(page.locator(".ga-pending-item img")).toHaveCount(0);
  await expect(page.locator(".ga-card")).toHaveCount(3);
  await expect(page.locator("#ga-grid")).not.toContainText("New GA signal");
  await page.setViewportSize({ width: 320, height: 960 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("[data-feature=cloud-sandboxes] .badge-preview")).toHaveText("Public preview");
});

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
  await expect(page.getByRole("button", { name: "Compare Dynamic Workflows", exact: true })).toBeFocused();
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
  await page.getByRole("button", { name: "Switch color theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch color theme", exact: true })).toHaveAttribute("title", "Switch to dark theme");
  await page.screenshot({ path: "test-results/flight-deck-mobile.png", fullPage: true });
});

test("dashboard controls, result counts, and comparison remain usable across breakpoints", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?clawpilotTheme=light");
    await expect(page.locator("#result-count")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const selector of [".nav-button", ".filter-chip", ".card-actions .button", ".compare-toggle", "#theme-toggle"]) {
      const heights = await page.locator(selector).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
      expect(heights.every((height) => height >= 44)).toBe(true);
    }
    await page.getByRole("button", { name: "Public preview", exact: true }).click();
    await expect(page.locator("#result-count")).toHaveText("3 of 6 capabilities");
    await page.getByRole("button", { name: "Compare Computer Use", exact: true }).click();
    await expect(page.locator("#compare-rail")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("footer").scrollIntoViewIfNeeded();
    const footer = await page.locator("footer").boundingBox();
    const rail = await page.locator("#compare-rail").boundingBox();
    expect(footer.y + footer.height).toBeLessThanOrEqual(rail.y);
  }
});

test("mobile navigation reveals the current view without scrolling the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#view=radar");
  const button = page.getByRole("button", { name: "Preview radar", exact: true });
  await expect(button).toHaveAttribute("aria-current", "page");
  const navigation = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
  const active = await button.boundingBox();
  expect(active.x).toBeGreaterThanOrEqual(navigation.x);
  expect(active.x + active.width).toBeLessThanOrEqual(navigation.x + navigation.width);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("secondary dashboard text retains AA contrast in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.goto(`/?clawpilotTheme=${theme}`);
    const ratios = await page.evaluate(() => {
      const luminance = (color) => {
        const components = color.match(/[\d.]+/g).slice(0, 3).map((value) => {
          const channel = Number(value) / (color.startsWith("color(srgb ") ? 1 : 255);
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
      };
      return [".hero-copy > p", ".breadcrumb", ".topbar-date", ".section-heading p", ".metric small", ".feature-card .summary", ".card-kit", "#result-count"].map((selector) => {
        const element = document.querySelector(selector);
        let background = element;
        while (getComputedStyle(background).backgroundColor === "rgba(0, 0, 0, 0)") background = background.parentElement;
        const foregroundLuminance = luminance(getComputedStyle(element).color);
        const backgrounds = [getComputedStyle(background).backgroundColor];
        if (selector === ".hero-copy > p") {
          const probe = document.createElement("span");
          probe.style.color = "var(--cp-link-panel)";
          document.body.append(probe);
          backgrounds.push(getComputedStyle(probe).color);
          probe.remove();
        }
        return Math.min(...backgrounds.map((color) => {
          const backgroundLuminance = luminance(color);
          return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
        }));
      });
    });
    expect(ratios.every((ratio) => ratio >= 4.5)).toBe(true);
  }
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
  await page.locator(".nav-button[data-view=ga]").click();
  await page.getByLabel("Announcement window").selectOption("0");
  await expect(page.locator(".ga-card")).toHaveCount(3);
  expect(network).toEqual([]);
});
