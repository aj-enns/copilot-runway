# GitHub Agentic Workflows: preview scout

**10 minutes | Technical preview | GitHub Actions | Kit-tested; paid reasoning run not performed**

## Customer story

Separate deterministic discovery from AI interpretation. Fetch only official sources, let a narrowly scoped agent draft a candidate review, and require a human PR review before adding any feature to the catalog.

## Prepare and rehearse

```powershell
npm run demo:setup -- agentic-workflows
npm run demo:rehearse -- agentic-workflows
gh aw --version
npm run workflow:compile
```

This repository compiles with `gh aw v0.86.2`. Use the pinned compiler version in CI; review upgrades as code changes. Commit the Markdown source and generated `.lock.yml` together.

## Show the control boundary

1. Open `.github\workflows\preview-discovery.yml`: a scheduled, deterministic feed scan. It calls no model and writes only a bounded issue digest through a separate step.
2. Open `.github\workflows\preview-scout.md`: read-only agent permissions, approved source domains, an opt-in condition, and a draft-PR-only safe output restricted to `catalog/proposals/**`.
3. Open the compiled `preview-scout.lock.yml`. Confirm that main-branch writes, merges, deployment, and readiness promotion are not agent outputs.
4. Show the flight deck's Radar. A discovery signal is not an adopted feature or a verified lifecycle.

## Optional live reasoning run

An administrator must approve engine authentication, repository Actions policy, PR creation, and budget. Configure the documented `COPILOT_GITHUB_TOKEN` secret only through an authorized secret-management flow. Do not place a token in files, command history, screenshots, or this repository. This kit never creates one.

Set repository variable `RUNWAY_AGENTIC_ENABLED=true` only after approval. The workflow stays inactive without it. The scheduled deterministic scan remains useful with no AI credential.

After the operator explicitly approves the paid run:

```powershell
gh workflow run preview-scout.lock.yml --repo aj-enns/copilot-runway
gh run list --repo aj-enns/copilot-runway --workflow preview-scout.lock.yml --limit 3
gh run watch RUN_ID --repo aj-enns/copilot-runway --exit-status
gh aw audit RUN_ID
```

Replace `RUN_ID` with the exact run returned by GitHub. If there are no new candidates, a successful `noop` is expected, not an empty PR.

Inspect the proposed document and its official citations. It must remain candidate-only and must not alter `catalog/features.json`, gate statuses, slide briefs, last-verified dates, workflow permissions, or deployment.

If a draft PR was produced, record its exact links in `.demo-workspaces\agentic-workflows\candidate-review.json`:

```json
{
  "classification": "candidate",
  "adopted": false,
  "workflowRunUrl": "https://github.com/aj-enns/copilot-runway/actions/runs/REPLACE_WITH_RUN_NUMBER",
  "draftPullRequestUrl": "https://github.com/aj-enns/copilot-runway/pull/REPLACE_WITH_PR_NUMBER"
}
```

Then run `npm run demo:verify -- agentic-workflows`. This validates the local evidence shape, not the remote run's authenticity; the GitHub trace and PR are the live evidence.

## Reset

```powershell
npm run demo:reset -- agentic-workflows
```

Disable the opt-in if it was only enabled for the demo. Cancel only the exact active demo run. Close only the synthetic draft PR if the owner approves. Local reset does not delete Actions logs, PRs, engine credentials, or remote state.

## Cost and failure

Inference and Actions runtime are separate charges. If authentication or policy is missing, do not dispatch a run hoping it will work. Demonstrate the offline control story and clearly label it as such.

## Official sources

- https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/
- https://github.com/github/gh-aw
- https://github.github.io/gh-aw/setup/quick-start/
- https://github.github.io/gh-aw/reference/safe-outputs/
