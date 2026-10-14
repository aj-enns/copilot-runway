# Account context and demo production: integration vision

Status: front-end prototype, reviewed 14 October 2026. Neither WorkIQ retrieval nor video recording is connected. No authentication, backend, workflow dispatch, live Computer Use, or video generation is implemented by these screens.

## What works now

- **Account context:** a visible people icon and "Pull your account context" entry point, configurable 7/30/90-day handoff prompt, three explicitly fictional account examples, feature-detail links, current catalog readiness verdicts, and sample clearing.
- **Private handoff:** copy a read-only prompt into an approved user-authenticated Copilot + WorkIQ session. Copying does not launch a session or transmit data.
- **Demo lab:** an original concept image for the selected feature, illustrated prepare/run/verify/reset instructions, copyable presenter commands, and the existing stop/reset rehearsal.
- **Recording planner:** choose a 90-second or 3-minute target, build a local four-scene storyboard, and download a Markdown recording brief. These are planning artifacts, not videos or proof of a live demo. Changing the feature or target invalidates the old brief.

The portal stays self-contained, with `connect-src 'none'`. Samples and recording plans are in-memory only. Reloading clears them; only the deliberately downloaded public/synthetic recording brief persists. No connector installs, tenant consent, or work-data queries happen here.

## 1. Personalized account context

### Initial delivery path

Use each viewer's approved **local Copilot session with WorkIQ installed and authenticated**. The official WorkIQ repository documents the plugin marketplace and standalone MCP setup. The portal can prepare a prompt; a public static page cannot silently identify its visitor, launch an authorized desktop agent, or retrieve their Microsoft 365 data.

The proposed read-only request covers a user-selected time window, confirms account scope, cites authorized source links/dates, separates confirmed needs from inference, and recommends only curated features. Context may be incomplete: meeting/email activity is not an authoritative CRM account inventory. Account/entity resolution and recommendation confidence need validation before a real connector ships.

### Authentication and browser integration

GitHub and Microsoft 365 identities are separate. GitHub login or `GITHUB_TOKEN` does not confer the viewer's Microsoft 365 permissions. WorkIQ's published admin guidance requires appropriate Microsoft 365 Copilot licensing, delegated permissions, and tenant administrator consent.

A browser-backed experience would need a **separate, approved private service**. Before implementation, validate the supported WorkIQ hosting/authentication contract and a per-user delegated Microsoft Entra flow. A browser OAuth client or an on-behalf-of flow must not be assumed to work with the current CLI/MCP package simply because generic Entra APIs support it.

Required acceptance criteria:

1. User-initiated sign-in and scoped retrieval; tenant/subject isolation and supported consent flow.
2. An enforced read-only tool allowlist, not only a prompt instruction; source-level authorization and limited retrieval.
3. No work-data credentials in this public repository, Pages bundle, query strings, Actions secrets used to impersonate viewers, public logs, or artifacts.
4. Private response handling; no automatic uploads of account context, citations, messages, names, or recommendations to GitHub.
5. Explicit retention, deletion/disconnect, auditing, data-processing approval, failure states, and separate license/cost approval.
6. Human-reviewed recommendations with source dates, confidence, gaps, and unchanged readiness gates.

Do not use a shared employee/service-account session for all visitors. Do not request broad write access or tenant consent from this prototype. Any consent or permission changes belong to an independently approved integration.

## 2. Demo video production

### Available planning artifact

Each recording brief captures the selected capability, target length, scene timings, setup/presenter/verify/reset instructions, expected evidence, separate remote cleanup, and recording guardrails. The timestamp allocation is editorial planning, not a runtime guarantee. Local helper verification does not certify that a real Copilot feature or account policy was exercised.

### Future recording options

- **Browser-only:** evaluate Playwright capture against synthetic browser demos with explicit assertions and a reviewed narration/caption script.
- **Desktop Computer Use:** GitHub documents this for **local macOS and Windows sessions**. Validate an approved interactive OS session, supported Copilot/plugin version, application access, screen recording, and human approvals. No unattended or hosted-runner compatibility is claimed.
- **Actions orchestration:** later, a private manually approved pipeline could coordinate an approved recorder/runner, validate fixtures, capture clips, stop on failures, collect only synthetic outputs, and request review. A normal hosted Linux job is not a substitute for local desktop Computer Use. Do not bypass approvals, run with blanket permissions, or start an interactive runner using this prototype.

A real recording service needs authenticated dispatch, an approved GUI/capture environment, queue/cancellation and failure handling, separate AI-credit and runner budgets, bounded runtime, redaction, retention, and a human publication checkpoint. Review platform terms and unattended-execution support before authoring a runner workflow.

Never combine real WorkIQ account data with a public demo recording. Do not embed passwords, tenant data, desktop notifications, or other people's information. Only verified, approved recordings may be labeled "live demo"; concept illustrations must remain clearly labeled.

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
