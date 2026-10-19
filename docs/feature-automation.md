# Continuous feature automation

Runway can prepare and release complete synthetic feature kits without per-feature manual implementation. Automation is **disabled by default** until the operator configures approved limits, inference authentication, a release App, and branch protection.

## What runs

1. **Research:** the daily scout fetches allowlisted official sources, selects new signals and existing features due for weekly reassessment, and writes one structured proposal PR.
2. **Generation:** a separate producer checks out the trusted research base, validates the proposal against its fetched evidence, and generates docs, a data-only demo, illustrations, assessments, and slides. It runs project, browser, artifact, and PowerPoint checks without release credentials.
3. **Publication:** a repository-scoped GitHub App creates a content-only release PR. Exact-head CI must succeed before the separate release job merges it. Main-push Pages validation/deployment publishes the site.

The proposal PR is research input, not the feature release. Source snapshots, proposal lineage, generated file hashes, release commits, and check results are linked by run IDs. Missing output is incomplete work, not “nothing new.”

### Scout status on the Flight deck

The footer shows **Last Scout run**: its start time in UTC, outcome (or in-progress status), and a link to the run. Pages reads the latest Scout run on `main` from this repository during the build. This requires Actions read permission; a failed lookup blocks deployment rather than displaying a successful fallback.

This is a build-time snapshot, not live status. Scout success does not prove its findings were published. A release merge triggers a new Pages build; a Scout run without a release does not. To refresh the snapshot independently, manually run **Publish Runway Pages** after Scout finishes.

Local builds do not query Actions by default and show “not recorded in this build.” Set `RUNWAY_SCOUT_REPOSITORY=owner/repo` to include a snapshot; `GH_TOKEN` can supply Actions read authentication. The deployed portal makes no runtime network calls. Build, Scout, and automated assessment dates never renew human verification or readiness.

## Readiness is not publication approval

An automatically generated kit can publish with **Hold for evidence**. Machine-generated features remain lifecycle **unverified**, with `verifiedOn: null`, automated provenance, and required findings of `unknown` or `fail`. Human-reviewed lifecycle stages and readiness passes require substantive source review.

Existing curated records retain their human verification dates and findings. Automated reassessments add a separate conservative review and keep the verdict on hold; they never silently renew dates or promote readiness. Sources leaving a feed remain in the evidence archive. Failed retrieval does not replace good evidence or masquerade as a fresh assessment.

Offline tests certify the kit's input/output and reset behavior, not a real Copilot feature or tenant policy. Live status remains **not-run**.

## Operator setup

Use repository-scoped Actions configuration, not the `github-pages` environment.

| Type | Name | Purpose |
| --- | --- | --- |
| Secret | `COPILOT_GITHUB_TOKEN` | Approved Copilot inference authentication |
| Variable | `RUNWAY_AGENTIC_ENABLED` | `true` enables the scout's schedule/manual run |
| Variable | `RUNWAY_AUTOMATION_ENABLED` | `true` enables trusted generation after research |
| Variable | `RUNWAY_AUTOPUBLISH_ENABLED` | `true` enables machine PR publication and release |
| Variable | `GH_AW_DEFAULT_MAX_TURNS` | Must match the approved `maxTurns` policy |
| Variable | `GH_AW_DEFAULT_TIMEOUT_MINUTES` | Must match the approved `timeoutMinutes` policy |
| Variable | `RUNWAY_APP_ID` | Dedicated release GitHub App ID |
| Variable | `RUNWAY_APP_INSTALLATION_ID` | Its installation ID for this repository |
| Secret | `RUNWAY_APP_PRIVATE_KEY` | App private key; never available to research or generation |

In [automation.json](../catalog/automation.json), explicitly configure `maxItemsPerRun`, `maxResearchDocuments`, `maxTurns`, and `timeoutMinutes`; set `enabled` and `billingApproved` after approval. Set `publicationEnabled` only for automatic release. Missing values fail closed.

Approve a real provider/account billing budget before enabling. Runtime, turn, and soft AI-credit limits do not guarantee a billed-spend cap.

Install the App only on this repository. It needs Contents and Pull requests write, Actions and Checks read, and Administration read to inspect branch protection. It must **not** bypass branch rules or grant administration write. Configure strict, up-to-date required status checks for `quality` and `workflow-source` on `main`; the release job refuses to merge without them. If organization policy requires human approval, automation stops rather than bypassing it.

App-created PRs trigger normal CI; App-created merges trigger Pages. No token needs to be copied into URLs, Git config, prompts, artifacts, or history.

## Structured research output

The scout reads `catalog/proposals/.research.json`, prepared by trusted code. It contains `runId`, `baseSha`, a bounded `queue`, and fetched `documents` with URL, text, fetch date, and SHA-256.

Write only `catalog/proposals/runway-batch.json`:

```json
{
  "schemaVersion": 1,
  "runId": "EXACT_RESEARCH_RUN_ID",
  "baseSha": "EXACT_RESEARCH_COMMIT_SHA",
  "decisions": [
    {
      "id": "EXACT_QUEUE_ITEM_ID",
      "outcome": "pending",
      "reason": "Required evidence or a supported demo is missing.",
      "citations": []
    }
  ]
}
```

Return exactly one decision per queue item. Outcomes:

- **feature:** a major new capability with a complete supported kit. Include `feature`, `sources`, and `enterpriseUseCases`.
- **review:** an existing feature reassessment. Include `findings`, one `{gate,status,reason,next}` per required gate; only unknown/fail.
- **excluded:** a routine release or otherwise out-of-scope signal, with the reason.
- **unchanged:** reviewed, no material change; do not renew human dates.
- **pending:** insufficient evidence or an unsupported demo. Record the attempt but keep it retryable, behind unattempted work; never renew assessment dates.

Every feature/review needs citations of exactly `{url,sha256,quote}`. The quote must be an exact 20–1200-character passage from the matching trusted document. A valid host or plausible title alone is not evidence. Do not infer lifecycle or tenant eligibility from a release number.

### Feature contract

Follow the existing feature record structure in [features.json](../catalog/features.json), with these restrictions:

- Unique stable kebab-case ID, concise text, `icon: "apps"`, `featured: false`, `verifiedOn: null`.
- `lifecycle` has `status: "unverified"`, `source`, and an explicit signal/uncertainty note.
- Each source is new, cited, and has `title`, `shortTitle` (maximum 40 characters), official `url`, `publisher`, `kind`, and `verifiedOn: null`.
- All source references belong to those grounded sources; never overwrite human source records.
- Enablement entries contain `title`, `detail`, empty `command`, and `sources`. Do not invent executable commands.
- Every required gate has `gate`, unknown/fail `status`, `reason`, `sources`, and `next`.
- `cost` includes `headline`, `detail`, explicit `assumptions`, and `sources`; unmeasured cost stays unmeasured.
- `demo` includes `title`, `minutes`, `mode`, `status: "kit-tested"`, `liveStatus: "not-run"`, `runbook: "demos/FEATURE_ID/README.md"`, `prompt`, `expected`, `remoteCleanup`, and `recipe`. Trusted generation must validate the recipe before the claim is accepted.
- Include one to three distinct enterprise-use strings, each no longer than 80 characters.

The materializer adds machine provenance; the agent cannot invent it. Unknown JSON keys or unsupported operations are rejected. Name/tagline/summary limits are 80/160/600 characters. Gate reasons/next actions are limited to 400/240 characters. Use at most six enablement steps, five value points, eight limitations, and a 1–30 minute demo. Keep detail in the runbook rather than repeating the summary.

### Supported synthetic recipe

Recipes are data, never JavaScript, shell, SVG, HTML, or templates. Version 1 supports only `classify-required-booleans`.

```json
{
  "schemaVersion": 1,
  "files": {
    "input.json": "{\"operation\":\"classify-required-booleans\",\"requiredFields\":[\"audit\"],\"records\":[{\"id\":\"demo-app\",\"audit\":false}]}"
  },
  "output": "result.json",
  "expected": {
    "schemaVersion": 1,
    "operation": "classify-required-booleans",
    "classification": "synthetic",
    "summary": {"total": 1, "passed": 0, "blocked": 1},
    "results": [{"id": "demo-app", "decision": "blocked", "missing": ["audit"]}]
  },
  "steps": [{"title": "Inspect the input", "detail": "Check the synthetic audit field."}],
  "controlStory": ["Synthetic input", "Evaluate required controls", "Inspect blocked result"]
}
```

Use 1–5 required boolean fields and 1–10 unique synthetic records. Exactly one `input.json` file is allowed. Output is a simple JSON filename. Steps and story strings are bounded plain text. Expected output must exactly match the trusted interpreter.

Only use this recipe when it meaningfully illustrates the capability's control story. If it cannot, return pending; do not pretend a generic classification exercises the real feature. Adding new executable recipe operations requires a normal reviewed infrastructure change.

## Validation and recovery

The dashboard footer shows **Site built** with a UTC timestamp and **Latest automated assessment** with the newest machine-assessment date included in that build. If none exists, it says **not recorded**. Build time is not deployment completion: confirm the Pages run succeeded. Neither value changes the top-bar human **Evidence reviewed** date or proves live readiness. An unchanged/excluded queue decision or source scan alone is not a new feature assessment.

```powershell
npm run automation:prepare
npm run artifacts
npm run check
npm run artifacts:check
python scripts\verify_pptx.py
npm run workflow:compile
```

Preparation is a live source fetch and requires configured inference limits; unit/integration tests use synthetic sources instead. Generation uses trusted base-branch scripts only. Model content cannot modify workflows, dependencies, instructions, scripts, gates, policy, or credentials.

If the main branch advances during generation/release, regenerate against its new head. Never force-push stale content. Inspect **Runway feature producer**, **Runway automatic release**, and **Publish Runway Pages** separately: research completion, PR creation, merge, and successful deployment are different outcomes.

To stop new inference, disable `RUNWAY_AGENTIC_ENABLED`. To stop generation, disable `RUNWAY_AUTOMATION_ENABLED`. To stop publication, disable `RUNWAY_AUTOPUBLISH_ENABLED` and the policy publication flag. Already active jobs may need cancellation by exact run ID. Revoke the App installation token or disable the App if emergency credential containment is required. Do not delete session stores or unrelated resources.
