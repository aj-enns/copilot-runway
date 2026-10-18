# Account context and demo production: integration vision

Status: front-end prototype, reviewed 14 October 2026. WorkIQ, recording, authentication, backend services, workflow dispatch, live Computer Use, and video generation are not connected.

## What works now

- **Account context:** a 7/30/90-day handoff prompt, three fictional accounts, readiness-aware feature links, and sample clearing.
- **Private handoff:** copy a read-only prompt to an approved, authenticated Copilot + WorkIQ session. Copying does not launch or transmit data.
- **Demo lab:** concept images, prepare/run/verify/reset instructions, presenter commands, and offline rehearsal.
- **Recording planner:** create a four-scene, 90-second or 3-minute storyboard and download a Markdown brief. These are plans, not videos or live-demo evidence. Changing the feature or target invalidates the brief.

The portal is self-contained (`connect-src 'none'`). Samples and plans exist only in memory and clear on reload; only a deliberately downloaded synthetic brief persists. No connector, tenant consent, or work-data query is used.

## 1. Personalized account context

### Initial delivery path

Use each viewer's approved **local Copilot session with WorkIQ installed and authenticated**. WorkIQ documents plugin marketplace and standalone MCP setup. This public page can prepare a prompt, but cannot identify a visitor, launch an authorized agent, or retrieve Microsoft 365 data.

The read-only request uses a selected time window, confirms account scope, cites authorized sources and dates, separates facts from inference, and recommends curated features. Email and meeting activity is not an authoritative CRM inventory. Validate account resolution and recommendation confidence before building a connector.

### Authentication and browser integration

GitHub and Microsoft 365 identities are separate: GitHub login or `GITHUB_TOKEN` grants no Microsoft 365 access. WorkIQ requires appropriate licensing, delegated permissions, and tenant admin consent.

A browser experience needs a **separate, approved private service**. Validate WorkIQ's supported hosting/authentication contract and per-user delegated Entra flow first. Do not assume a browser OAuth or on-behalf-of flow works with the current CLI/MCP package.

Required acceptance criteria:

1. User-initiated sign-in, scoped retrieval, tenant isolation, and supported consent.
2. Enforced read-only tools, source authorization, and limited retrieval—not prompt-only restrictions.
3. No work-data credentials in this public repo, Pages, query strings, impersonating Actions secrets, logs, or artifacts.
4. Private responses; no automatic upload of account data or recommendations to GitHub.
5. Defined retention, deletion/disconnect, audit, data-processing approval, failure states, and license/cost approval.
6. Human-reviewed recommendations with sources, confidence, gaps, and unchanged readiness gates.

Never share one employee/service-account session across visitors or request broad write access or tenant consent from this prototype. Permission changes belong to an independently approved integration.

## 2. Demo video production

### Available planning artifact

Each brief includes the feature, target length, scene timings, presenter steps, evidence, remote cleanup, and safeguards. Timings are editorial, not guarantees. Local checks do not prove that Copilot or account policy was exercised.

### Future recording options

- **Browser:** evaluate Playwright capture with synthetic demos, explicit assertions, and reviewed narration/captions.
- **Desktop Computer Use:** documented for **local macOS and Windows**. Validate the approved interactive session, client/plugin versions, app access, screen recording, and human approvals. Hosted or unattended use is unverified.
- **Actions:** a future private, manually approved pipeline could run an approved recorder, validate fixtures, capture synthetic clips, stop on failure, and request review. Hosted Linux is not a substitute for local Computer Use. Do not bypass approvals, grant blanket permissions, or start an interactive runner from this prototype.

A recording service needs authenticated dispatch, an approved capture environment, queue/cancellation and failure handling, separate AI and runner budgets, bounded runtime, redaction, retention, and human publication review. Check platform terms and unattended-execution support before building a runner.

Never combine real WorkIQ data with public recordings or include passwords, tenant data, notifications, or others' information. Label only verified, approved recordings "live demo"; keep illustrations clearly labeled.

## Implementation surfaces

| Surface | Current implementation | Future seam |
| --- | --- | --- |
| `site/index.html` | Context navigation/callout and planned integration panels | Private connection status and consent-aware UX |
| `site/app.mjs` | Fictional examples, private prompt, illustrated guides, local recording brief | Approved authenticated connector and dispatch adapters |
| `scripts/build.mjs` | Offline icons, visual assets and blueprint download | No private data may be embedded here |
| `tests/browser/portal.spec.mjs` | No-network boundaries, fixture matches, guides, plan invalidation, downloads | Tenant isolation, connector failures, queue/cancel and capture evidence |

## Primary sources

- [Official Microsoft WorkIQ repository and setup](https://github.com/microsoft/work-iq)
- [WorkIQ tenant administrator enablement](https://github.com/microsoft/work-iq/blob/main/ADMIN-INSTRUCTIONS.md)
- [Microsoft user/admin consent overview](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/user-admin-consent-overview)
- [GitHub Copilot CLI Computer Use requirements](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/computer-use)
- [About Computer Use in GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/computer-use)
