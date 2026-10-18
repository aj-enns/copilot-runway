# Automation setup and trust boundaries

## GitHub Pages

Pages is configured for **GitHub Actions** at https://aj-enns.github.io/copilot-runway/. The site and source repository are deliberately **public**, with no GitHub sign-in required to view the portal. The `pages.yml` workflow publishes only generated `dist` content. It does not upload `.git`, dependencies, credentials, session logs, or demo workspaces.

The [Pages pipeline](../.github/workflows/pages.yml) runs on pushes to `main`, a daily schedule, and manual dispatch. Its build job validates evidence and artifacts, runs unit tests, refreshes official-source signals, builds the portal, and runs the Playwright browser suite before uploading a Pages artifact. The separate deployment job requires that build to succeed and uses GitHub's `deploy-pages` action with scoped Pages/OIDC permissions. A failed browser check cannot publish the refreshed UI.

GitHub Pages availability and private-site access depend on the organization's plan and policy. A private repository does not automatically mean its Pages site is private. Publish only this repository's public, synthetic enablement artifacts; keep customer-specific assessments in the customer's approved system.

The daily Pages run refreshes Radar and review-pending GA candidates at build time without writing authoritative source files back to main. A source-fetch failure stops publication rather than silently serving an empty "all current" result.

## Deterministic preview discovery

`preview-discovery.yml` has separate scan and digest jobs. Scanning has read-only repository access and calls no model. The digest job alone has issue-write permission and updates only its marker-identified, `github-actions[bot]`-owned issue. Stable content hashes prevent repeated unchanged updates.

The scanner does not forward a GitHub token to public sources. HTTPS hosts and redirect destinations are allowlisted, response size is capped, publication dates are checked, RSS entities are restricted, content is flattened, and failures are explicit. Titles/bodies are data, never commands.

GitHub Actions writes are governed by repository/enterprise policy. If issue creation is disabled, the successful scan artifact is still available, but the digest job must show its failure; it must not claim a posted report.

## GA tracking boundaries

`catalog/ga.json` is a durable, human-reviewed archive, not an automatically inferred lifecycle. Entries distinguish feature GA from model availability, cite reviewed primary announcements in `catalog/sources.json`, and include dated scope caveats. GA is historical announcement evidence, not proof that rollout is complete, a tenant is eligible, or enterprise gates have passed.

Daily ingestion marks Copilot announcements with explicit GA wording in the headline or opening sentence as candidate signals; later historical mentions in policy updates or roundups do not qualify. The Recently GA view excludes already archived announcement URLs, shows other signals separately as **Review pending**, and never treats every lifecycle signal or stable product release as GA. Feed windows remain bounded; the reviewed archive is preserved when announcements leave RSS. A maintainer must verify scope/date and add a reviewed entry. Preview feature records, verification dates, assessments, and pricing are unchanged by either discovery or GA filtering.

## Optional agentic interpretation

`preview-scout.md` is a real GitHub Agentic Workflow. `gh aw v0.86.2` compiles the versioned `.lock.yml`. Both must change together for frontmatter changes.

The workflow is **off until `RUNWAY_AGENTIC_ENABLED=true`**. No AI credential or persistent access is created by setup. Review Actions policy, engine data terms, inference/Actions budget, compiled jobs, network rules, tools, and safe-output scope before opting in.

An authorized administrator configures the documented `COPILOT_GITHUB_TOKEN` engine secret through approved secret-management tooling. Use the exact permission requirements in the current [official authentication guide](https://github.github.io/gh-aw/setup/quick-start/), not a broad classic token copied into shell history. Organization-billed `copilot-requests` may be an alternative when supported and approved; this repository does not assume it is configured.

The agent receives public discovery metadata and named catalog files, not customer context. Its job remains read-only for GitHub. The only configured content output is a **draft PR** under `catalog/proposals/**`, applied by a separate safe-output job. That allowlist is validated by the compiler/runtime; the natural-language prompt alone is not the write boundary.

The scout may not change feature admissions, lifecycle, verified dates, readiness, gates, costs, slides, scripts, workflows, or deployment. Existing covering proposals and no actionable new signals require `noop`. No automatic merge or approval is configured.

## Validation and updates

```powershell
gh aw --version
npm run workflow:compile
npm run check
npm run artifacts:check
python scripts\verify_pptx.py
```

CI installs the pinned compiler and checks that compilation produces no lock drift. Action references are immutable SHAs. Dependabot proposes dependency updates but does not merge them. Compiler and container upgrades require a reviewed regenerated lock, especially when official releases are retired.

For a new feature, add official evidence and every required gate, build a bounded demo with scoped reset, generate its brief, and review the full change. Discovery never extends a verification date; only a substantive human source review may do that.
