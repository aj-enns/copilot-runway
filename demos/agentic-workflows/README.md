# GitHub Agentic Workflows: preview scout

**10 minutes | Technical preview | GitHub Actions | Kit-tested; no paid reasoning run**

## Customer story

Separate deterministic discovery from AI interpretation: scan official sources, draft a candidate review, and require human PR review before catalog changes.

## Prepare and rehearse

```powershell
npm run demo:setup -- agentic-workflows
npm run demo:rehearse -- agentic-workflows
gh aw --version
npm run workflow:compile
```

Use pinned compiler `gh aw v0.92.0`. Review upgrades as code changes and commit Markdown with its generated `.lock.yml`.

## Show the control boundary

1. Open `.github\workflows\preview-discovery.yml`: scheduled, model-free scan with a bounded issue digest.
2. Open `.github\workflows\preview-scout.md`: read-only permissions, approved domains, opt-in, and draft-PR output limited to `catalog/proposals/**`.
3. Open `preview-scout.lock.yml`. Confirm the agent cannot write to main, merge, deploy, or promote readiness.
4. Show the flight deck's Radar. A discovery signal is not an adopted feature or a verified lifecycle.

## Optional live reasoning run

An administrator must approve engine authentication, Actions policy, PR creation, and budget. Configure `COPILOT_GITHUB_TOKEN` only through approved secret management—never in files, history, screenshots, or this repo. The kit does not create it.

After approval, set `RUNWAY_AGENTIC_ENABLED=true`. Without it, the workflow stays inactive; deterministic scans need no AI credential.

After explicit approval of the paid run:

```powershell
gh workflow run preview-scout.lock.yml --repo aj-enns/copilot-runway
gh run list --repo aj-enns/copilot-runway --workflow preview-scout.lock.yml --limit 3
gh run watch RUN_ID --repo aj-enns/copilot-runway --exit-status
gh aw audit RUN_ID
```

Replace `RUN_ID` with the returned run ID. No new candidates should produce a successful `noop`, not an empty PR.

Review the proposal and citations. It must remain a candidate and leave feature data, gates, briefs, verification dates, workflow permissions, and deployment unchanged.

If a draft PR was produced, record its exact links in `.demo-workspaces\agentic-workflows\candidate-review.json`:

```json
{
  "classification": "candidate",
  "adopted": false,
  "workflowRunUrl": "https://github.com/aj-enns/copilot-runway/actions/runs/REPLACE_WITH_RUN_NUMBER",
  "draftPullRequestUrl": "https://github.com/aj-enns/copilot-runway/pull/REPLACE_WITH_PR_NUMBER"
}
```

Then run `npm run demo:verify -- agentic-workflows`. It checks local evidence shape; the GitHub trace and PR prove the live run.

## Reset

```powershell
npm run demo:reset -- agentic-workflows
```

Disable the opt-in if enabled for the demo. Cancel only its active run; close only its synthetic draft PR with owner approval. Local reset does not delete logs, PRs, credentials, or remote state.

## Cost and failure

Inference and Actions runtime are separate charges. If authentication or policy is missing, do not dispatch; show and label the offline rehearsal instead.

## Official sources

- https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/
- https://github.com/github/gh-aw
- https://github.github.io/gh-aw/setup/quick-start/
- https://github.github.io/gh-aw/reference/safe-outputs/
