# Automation setup and trust boundaries

## GitHub Pages

GitHub Pages publishes the public portal at https://aj-enns.github.io/copilot-runway/; no sign-in is needed. The `pages.yml` workflow uploads only generated `dist` content—not `.git`, dependencies, credentials, session logs, or demo workspaces.

The [Pages pipeline](../.github/workflows/pages.yml) runs on pushes to `main`, daily, and on manual dispatch. It validates evidence and artifacts, runs unit and Playwright tests, refreshes official-source signals, and builds the portal before uploading an artifact. A separate job deploys only after the build succeeds, using `deploy-pages` with scoped Pages/OIDC permissions.

Pages availability and private-site access depend on the organization's plan and policy; a private repository does not make its site private. Publish only public, synthetic enablement artifacts here. Keep customer assessments in the customer's approved system.

Daily builds refresh Radar and review-pending GA candidates without writing to authoritative source files. If a source fetch fails, publication stops rather than presenting an empty result as current.

## Deterministic preview discovery

`preview-discovery.yml` separates scanning from digesting. The scan is model-free and read-only. Only the digest job can write issues, and it updates only its marker-identified issue owned by `github-actions[bot]`. Content hashes prevent unchanged updates.

The scanner never sends a GitHub token to public sources. It allowlists HTTPS hosts and redirects, caps response size, checks publication dates, restricts RSS entities, flattens content, and reports failures explicitly. Titles and bodies are data, never commands.

Repository or enterprise policy may block issue creation. In that case, the scan artifact remains available, but the digest job must report failure—not claim a report was posted.

## GA tracking boundaries

`catalog/ga.json` is a human-reviewed archive, not an inferred lifecycle. Entries distinguish feature GA from model availability, cite primary announcements in `catalog/sources.json`, and record dated scope caveats. An announcement is historical evidence—not proof of rollout completion, tenant eligibility, or passed enterprise gates.

Daily ingestion flags Copilot announcements that say GA in the headline or opening sentence. Later mentions in policy updates or roundups do not qualify. Recently GA excludes archived URLs and labels other signals **Review pending**; lifecycle signals and stable product releases are not automatically GA. Feed windows stay bounded, while the reviewed archive survives items leaving RSS. Maintainers verify scope and date before adding entries. Discovery and GA filtering do not change preview records, verification dates, assessments, or pricing.

## Optional agentic interpretation

The scout runs daily at 11:21 UTC or on manual dispatch. It prioritizes existing features due for weekly reassessment and new official signals. Its explicit cron keeps compilation stable across local and CI environments.

`preview-scout.md` is a GitHub Agentic Workflow. Compile it with pinned `gh aw v0.92.0`; commit the source and generated `.lock.yml` together.

The workflow is **off** unless `RUNWAY_AGENTIC_ENABLED=true`. Setup creates no AI credential or persistent access. Before opting in, review Actions policy, engine data terms, budgets, compiled jobs, network rules, tools, and safe-output scope.

An authorized administrator must configure the `COPILOT_GITHUB_TOKEN` engine secret using approved secret-management tools. Follow the current [official authentication guide](https://github.github.io/gh-aw/setup/quick-start/) for exact permissions; do not copy a broad classic token into shell history. Organization-billed `copilot-requests` may be an approved alternative when supported, but this repository does not assume it is configured.

The agent sees public discovery metadata and named catalog files, never customer context. It cannot write to GitHub directly. A separate safe-output job can create only a **draft PR** under `catalog/proposals/**`; the compiler/runtime enforces this allowlist, not the prompt alone.

The scout writes structured, concise **research proposals only**. It cannot modify canonical evidence, scripts, workflows, gates, or deployment. A separate trusted producer validates the data, generates complete offline kits, and tests the result. An independently authorized release job can merge only its exact validated content. This path is disabled until its policy, budgets, App, and branch protection are configured; see [feature automation](feature-automation.md).

Machine-generated features remain explicitly unverified and on Hold. Automated reassessment never renews human verification dates or promotes readiness. Complete documentation may publish with unknown findings; unsupported or unsafe kits stay pending. No live demos are run automatically.

## Validation and updates

```powershell
gh aw --version
npm run workflow:compile
npm run check
npm run artifacts:check
python scripts\verify_pptx.py
```

CI installs the pinned compiler and checks for lock drift. Actions use immutable SHAs. Dependabot proposes, but does not merge, dependency updates. Review regenerated locks for compiler or container upgrades, especially when official releases are retired.

For each feature, add official evidence and required gates, build a bounded demo with scoped reset, generate its brief, and review the change. Discovery never extends verification dates; only substantive human source review can.
