# Dynamic Workflows: architecture triage with human review

**10 minutes | Experimental SDK API | Two synthetic inputs | Kit-tested; live feature not run**

## Not the same as GitHub Agentic Workflows

This demo runs a session-scoped Copilot SDK workflow, not GitHub Actions. The official SDK calls the API experimental. Execution eligibility can require token-based billing or trusted HMAC authentication; do not infer a public-preview entitlement from registration.

## Prepare and rehearse without inference

```powershell
npm run demo:setup -- dynamic-workflows
npm run demo:rehearse -- dynamic-workflows
```

The offline harness exercises the real workflow function with a deterministic adapter. It proves the input guards, null/failure handling, blocked audit decision, pause checkpoint, and journal reuse. It does **not** invoke Copilot agents or demonstrate live SDK admission.

## Live prerequisites

Review the extension source in `.github\extensions\runway-demo\extension.mjs` and `demos\dynamic-workflows\workflow.mjs`. It registers a workflow but starts no run, requests no secret, and declares no guessed limits. Start an approved compatible Copilot CLI from the **Runway repository root** so the project extension is discovered.

The workflow explicitly selects `.github\agents\runway-assessor.agent.md` for both specialists. Its `tools: []` profile disables tools instead of relying only on a "do not use tools" prompt. Confirm that profile is available and inspect its effective tool configuration before a live run. Model inference and durable journals still have their own data and billing implications.

Use the CLI's extension management tools to confirm that `runway-demo` loaded and inspect the registered `runway-architecture-review` metadata. If extensions or Dynamic Workflows are unavailable, stop. Do not install an unrelated package or substitute an Actions workflow.

## Present a specifically approved run

Give Copilot this request:

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

1. Choose an approved per-run budget/runtime/concurrency policy. A soft `maxAiCredits` limit is post-paid and can overshoot; it is not a billing hard stop.
2. After approving this specific run, ask Copilot to invoke it by registered name using the workflow run tool. Record the run ID.
3. Inspect **workflow** run detail/progress. Do not use ordinary `read_agent`/`write_agent` for workflow-owned agents.
4. The workflow must pause at human review. `contoso-batch` must be `blocked`; the other app is only `pilot-with-review`, never enterprise-certified.
5. Approve continuation explicitly. Resume using the same run ID. The assessments should be journaled, not re-run.
6. Export the completed report JSON, without changing its content, to `.demo-workspaces\dynamic-workflows\assessment.json`.

## Verify and cleanup

```powershell
npm run demo:verify -- dynamic-workflows
npm run demo:reset -- dynamic-workflows
```

Local verification checks the completed report contract and fixture facts; inspect live provenance separately. An offline report is deliberately rejected as a live output. Cancel any active workflow using its exact run ID before resetting. Local reset does not erase journaled session history. Never delete the whole session store.

## Failure behavior

`dynamic_workflows_unavailable`, unavailable durable storage, null/invalid assessments, inconsistent facts, cancellation, and hard limit failures are not successful results. A reached limit requires approval before raising it and resuming. The implementation rejects partial pipeline success.

Journal keys include a semantic version and canonical input identity. The workflow code submits no external action, and its specialist profile has no tools. At-least-once replay must not be extended with non-idempotent customer actions.

## Official source

https://github.com/github/copilot-sdk/blob/ad20f9f4319d48000b895c9c4180242c2232e1ab/nodejs/docs/workflows.md

https://docs.github.com/en/copilot/reference/custom-agents-configuration
