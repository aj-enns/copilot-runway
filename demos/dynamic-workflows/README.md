# Dynamic Workflows: architecture triage with human review

**10 minutes | Experimental SDK API | Two synthetic inputs | Kit-tested; not live-tested**

## Not the same as GitHub Agentic Workflows

This demo uses a session-scoped Copilot SDK workflow, not GitHub Actions. The SDK calls it experimental. Execution may require token-based billing or trusted HMAC authentication; registration does not imply preview access.

## Prepare and rehearse without inference

```powershell
npm run demo:setup -- dynamic-workflows
npm run demo:rehearse -- dynamic-workflows
```

The offline harness runs the workflow with a deterministic adapter, testing input guards, failures, blocked audit decisions, pause, and journal reuse. It does **not** invoke agents or prove live SDK access.

## Live prerequisites

Review `.github\extensions\runway-demo\extension.mjs` and `demos\dynamic-workflows\workflow.mjs`. The extension registers but does not start a run, request secrets, or guess limits. Start an approved compatible CLI from the **Runway repository root** to discover it.

Both specialists use `.github\agents\runway-assessor.agent.md` with `tools: []`, a real tool restriction rather than prompt-only guidance. Confirm the profile and effective tool configuration before a live run. Inference and durable journals have separate data and billing implications.

Use CLI extension tools to confirm `runway-demo` loaded and inspect `runway-architecture-review`. If unavailable, stop; do not install unrelated packages or substitute Actions.

## Present a specifically approved run

Ask Copilot:

```text
Inspect the registered runway-architecture-review workflow.
Propose a run with exactly the two synthetic apps below.
Explain eligibility and ask me to approve this exact run and my chosen resource
ceilings before starting. Do not invent a spend limit or use production inputs.
Pause at human-review, show the run ID and results, and wait for my explicit approval
before resuming the same run. Do not nest workflows or create external side effects.
```

Use these exact arguments:

```json
{
  "apps": [
    { "id": "northwind-api", "sso": true, "audit": true, "approvedEgress": true },
    { "id": "contoso-batch", "sso": true, "audit": false, "approvedEgress": true }
  ]
}
```

1. Set approved per-run budget, runtime, and concurrency. Soft, post-paid `maxAiCredits` can overshoot; it is not a billing hard stop.
2. Approve this run, invoke it by registered name with the workflow run tool, and record its ID.
3. Inspect **workflow** progress. Do not use ordinary `read_agent`/`write_agent` for workflow-owned agents.
4. Confirm the human-review pause. `contoso-batch` must be `blocked`; the other app is `pilot-with-review`, not certified.
5. Explicitly approve continuation and resume with the same ID. Journaled assessments should not rerun.
6. Export the unchanged report to `.demo-workspaces\dynamic-workflows\assessment.json`.

## Verify and cleanup

```powershell
npm run demo:verify -- dynamic-workflows
npm run demo:reset -- dynamic-workflows
```

Local verification checks the report contract and fixture facts, not live provenance. Offline reports cannot pass as live output. Cancel the exact active run before reset. Reset does not erase journals; never delete the session store.

## Failure behavior

Unavailable workflows/storage, invalid assessments, inconsistent facts, cancellation, and hard-limit failures are not success. Get approval before raising a reached limit and resuming. Partial pipeline results are rejected.

Journal keys include semantic version and canonical input identity. The workflow has no external actions and its specialist has no tools. Do not add non-idempotent customer actions to at-least-once replay.

## Official source

https://github.com/github/copilot-sdk/blob/ad20f9f4319d48000b895c9c4180242c2232e1ab/nodejs/docs/workflows.md

https://docs.github.com/en/copilot/reference/custom-agents-configuration
