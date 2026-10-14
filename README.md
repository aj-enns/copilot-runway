# Copilot Runway

**Evaluate. Explain. Demo.**

An independent enablement initiative for Cloud Solution Architects, turning GitHub Copilot preview features into evidence-backed enterprise assessments, clear value stories, and repeatable customer demos.

## Why Runway?

A runway prepares you for takeoff. Copilot Runway helps architects understand what a preview feature does, what an enterprise needs to enable it, and how to demonstrate its value before recommending adoption.

## Start at the flight deck

**[Open Copilot Runway](https://hammadorg93.github.io/copilot-runway/)** for searchable feature cards with concise enterprise use cases, release/readiness filters, side-by-side comparisons, full presenter kits, downloadable slides, an editable local policy workshop, a cost lab, the official-source Radar, and a Recently GA tracker.

The Pages site and source repository are **public**. The flight deck, slides, assessments, and runbooks require no GitHub sign-in to view.

The portal is a responsive, accessible, self-contained static HTML artifact. Its Microsoft Fluent-inspired workspace and GitHub Primer-style feature explorer use Segoe typography, official Octicons, compact command bars, and source-backed kit previews. It makes no runtime API calls and uses no analytics, third-party fonts, or customer data. Light/dark themes retain the Clawpilot design tokens; `?clawpilotTheme=light` or `?clawpilotTheme=dark` selects a theme explicitly.

## First-wave catalog

| Capability | Verified lifecycle | Pilot posture | Demo surface |
| --- | --- | --- | --- |
| [Computer Use](features/computer-use/assessment.md) | Public preview | Pilot with conditions | Native Windows/macOS app |
| [Dynamic Workflows](features/dynamic-workflows/assessment.md) | Experimental SDK API | Hold: admin-control and persisted-data evidence gaps | Session-scoped SDK extension |
| [GitHub Agentic Workflows](features/agentic-workflows/assessment.md) | Technical preview | Pilot with conditions | GitHub Actions / `gh aw` |
| [Cloud Sandboxes](features/cloud-sandboxes/assessment.md) | Public preview; experimental CLI flag | Pilot with conditions | Interactive cloud Linux |
| [Copilot Memory](features/copilot-memory/assessment.md) | Public preview | Pilot with conditions | Cited repository context |
| [Autopilot Mode](features/autopilot/assessment.md) | Experimental | Pilot with conditions | Bounded local repair/test task |

Official sources were reviewed on **2026-10-14**. This is a curated first wave, **not an exhaustive list of all Copilot previews**. Lifecycle, policy, pricing, and eligibility can change. The UI treats evidence older than 30 days as stale and blocks required gates pending re-review.

**Kit-tested is not live-feature-tested.** Fixtures, acceptance checks, offline orchestration, and repeatable reset are exercised by repository tests. Live account access, native app automation, paid SDK/Actions inference, cloud execution, server-side Memory, and tenant-specific policy enforcement are not claimed from those checks.

## Enterprise uses and GA history

Every feature card and Overview includes three short **potential enterprise uses**, searchable alongside the feature's name and surfaces. These are illustrative recommendations, not verified customer deployments or policy approval. Maintain them in the portal-only `enterpriseUseCases` map in `catalog/features.json`; validation requires concise examples for every known feature. They do not change generated assessments, slide inputs, or readiness evidence.

**[Recently GA](https://hammadorg93.github.io/copilot-runway/#view=ga)** defaults to announcements from the last 90 days, with 30-day/all-history and feature/model filters. The initial reviewed history includes local sandboxing (2026-10-07), Claude Haiku 5.5 model availability (2026-10-07), and Gemini 4 Argon model availability (2026-10-13). Local sandboxing's GA announcement does **not** graduate hosted Cloud Sandboxes.

The human-reviewed archive in `catalog/ga.json` survives feed rollover. To add an entry, verify the primary announcement, register its source/review date in `catalog/sources.json`, and record its GA date, type, concise potential enterprise use, and scope caveat. Daily scans surface new GA-looking announcements as **review-pending signals**, excluding already tracked announcement URLs. Retirement, stable CLI releases, and historical GA mentions are not proof of a feature graduation. Coverage is curated and bounded, not exhaustive; **GA never automatically changes enterprise readiness or tenant eligibility**.

## Enterprise non-negotiables

Use [the readiness policy](readiness/README.md), [versioned gate definitions](readiness/gates.json), and [customer assessment template](readiness/assessment-template.md). Every feature is assessed against availability, admin control, least privilege, data boundaries, human approval, audit, cost, network, operations, and rollback.

Required unknown, failed, missing, or stale evidence blocks readiness. Conditions require a named owner and actual tenant evidence. No weighted score or marketing badge can override a blocking gate. **Pilot gates satisfied never means production-certified.**

The Pages workshop can add local proposed requirements and export JSON. Repository policy changes require review, a rubric version change where appropriate, and an assessment for every feature.

## Value, cost, and official branding

[Download the combined 12-slide architect brief](artifacts/slides/copilot-runway.pptx), or open the two-slide deck linked from each feature. Briefs cover value, control story, readiness, cost assumptions, and how to start the demo; primary-source hyperlinks and detailed notes are embedded.

Enterprise Copilot usage is measured in **AI credits** under the reviewed current billing documentation. Do not reuse legacy premium-request assumptions as current enterprise pricing. Cloud sandbox compute, allocated memory, and snapshot storage are separate meters. The Cost lab is explicitly illustrative and excludes seats, Actions, taxes, and other services.

Official Copilot/GitHub icons come from pinned Primer Octicons. [Attribution and brand guidance](THIRD_PARTY_NOTICES.md) are included with the site and decks.

## Run and reset a demo

Use Node.js 22 or later:

```powershell
npm ci
npm run demo:setup -- computer-use
npm run demo:verify -- computer-use
npm run demo:reset -- computer-use
```

Follow the [presenter runbooks](demos/README.md) for real-feature prerequisites and steps. Setup prints an absolute path under `.demo-workspaces\<feature-id>`. Verification intentionally fails until the specified result exists. Autopilot's seeded acceptance tests fail again after reset.

Reset is marker-checked, rejects unknown files and symlinks/junctions, and touches only known synthetic files. **It does not revoke app permissions, delete memories/journals, stop cloud sessions, remove snapshots, close PRs, or reset account settings.** Those are separate, specifically authorized steps in the runbook.

The Dynamic Workflows extension registers `runway-architecture-review` on a compatible CLI without starting it, requesting secrets, or declaring guessed limits. Its real workflow includes runtime input validation, distinct agent labels, an explicitly selected **tool-free specialist profile**, null/failure handling, an input-versioned journal, and a human review checkpoint. `demo:rehearse` uses deterministic adapters and incurs no inference.

## Build and maintain

```powershell
npm ci
npm run artifacts
npm run build
npm run dev
```

`npm run dev` serves only the generated `dist` at `http://127.0.0.1:4173`. Open `dist\index.html` directly for an offline self-contained flight deck; keep its sibling folders for downloads.

```powershell
npm run validate
npm test
npm run artifacts:check
python scripts\verify_pptx.py
npx playwright install chromium
npm run build
npm run test:e2e
```

Unit tests cover blocking verdicts, stale/invalid evidence, enterprise-use coverage/search, GA history/filtering/deduplication, cost arithmetic, discovery boundaries, workflow failure/resume, the original seeded symptom, exact output contracts, and reset safety. Browser tests cover all six workspace views, filtering, keyboard tabs, direct links, downloads, comparison, persistence, escaped input, demo/reset interaction, mobile overflow, dark theme, stale evidence, CSP, and offline operation.

After changing authoritative feature/rubric/referenced-source content, regenerate the decks and Markdown with `npm run artifacts`. Portal-only enterprise-use recommendations and GA archive entries do not require slide regeneration; the evidence fingerprints remain enforced. `artifacts:check` rejects stale fingerprints. On a Windows machine with PowerPoint, `scripts\render-slides.ps1` exports the actual combined deck to `qa-results\slides` for visual QA; it closes only the presentation it opened.

## Staying current

| Automation | Schedule | Actual behavior |
| --- | --- | --- |
| `preview-discovery.yml` | Daily 09:17 UTC + manual | Fetches official Copilot RSS and CLI/gh-aw releases, preserves a bounded snapshot, and updates one deduplicated bot-owned issue digest. No model required. |
| `pages.yml` | Main push, daily 09:47 UTC, manual | Validates reviewed content, refreshes candidate-only Radar, builds, browser-tests, and deploys Pages. Failed ingestion or browser checks stop publication and do not replace the last deployed site. |
| `preview-scout.md` + `.lock.yml` | Weekly Monday + manual, **opt-in** | Uses a read-only agent and restricted safe outputs to propose one draft candidate-review PR. It cannot admit a feature, promote readiness, merge, or deploy. |
| `ci.yml` | Main push + PR + manual | Checks data, tests, artifact evidence, browser behavior, and matching compiled workflow source. |
| Dependabot | Weekly | Proposes npm and Actions pin updates for review. Compiler upgrades need explicit source/lock review. |

The official watchlist is in `catalog/watch.json`; `npm run sources:scan -- --update` refreshes only `catalog/monitor.json`. Responses and redirects are host-allowlisted, size/time bounded, parsed as inert data, and fail explicitly. RSS is a rolling window, not complete history. Signals include GA, retirement, policy, billing, and release changes as well as previews.

**Agentic authentication is not configured by this repository.** An administrator must approve the engine/budget, configure the documented `COPILOT_GITHUB_TOKEN` secret securely, and set `RUNWAY_AGENTIC_ENABLED=true`. Until then, the reasoning workflow is intentionally skipped; deterministic discovery and Pages still operate. Do not put tokens in source, screenshots, logs, or command history. See [automation setup](docs/automation.md).

## Repository map

| Path | Source of truth / purpose |
| --- | --- |
| `catalog/` | Structured feature evidence, portal use cases, reviewed GA history, verified sources, watchlist, discovery-only snapshot, candidate proposals |
| `readiness/` | Versioned required gates and assessment template |
| `features/` | Generated Markdown assessments |
| `artifacts/slides/` | Generated, cited PowerPoint briefs |
| `demos/` | Real-feature runbooks, synthetic fixtures, experimental orchestration logic |
| `site/` | Static portal source and shared pure assessment/calculation model |
| `scripts/` | Validation, build, discovery, scoped demo setup/reset, and artifact generation |
| `.github/workflows/` | CI, Pages, discovery, and source/compiled agentic scout |
| `.github/agents/` | Explicit tool-free Dynamic Workflows specialist profile |

Keep credentials, customer data, personal information, and confidential material out of the repository and generated Pages assets. Both are deliberately public. Publish only non-confidential, synthetic enablement material.
