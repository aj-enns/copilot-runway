# Customer demo kits

Start from the [Runway flight deck](https://aj-enns.github.io/copilot-runway/) and choose a feature's **Demo** tab. The site and source repository are public. All inputs in this repository are synthetic.

Each kit provides an actual feature walkthrough, prerequisites, a presenter prompt, expected evidence, local output verification, failure handling, and a scoped reset. The browser flight lab and `demo:rehearse` are **offline rehearsals**, not Copilot implementations.

## Shared preparation

Use Node.js 22 or newer and an approved, current Copilot CLI. From the repository root:

```powershell
npm ci
npm run demo:setup -- computer-use
```

Replace the feature ID with `dynamic-workflows`, `agentic-workflows`, `cloud-sandboxes`, `copilot-memory`, or `autopilot`. The script prints the absolute workspace path. Copy that path into your next terminal command; do not start Copilot in your home directory.

The scripts never log in, create a credential, enable a policy, grant app access, invoke a model, create a cloud session, or dispatch a workflow. Verify eligibility and obtain the necessary authorization separately.

## Verification is deliberately split

**Kit-tested** means repository tests exercised fixture setup, acceptance checks, offline logic, failure cases, and repeatable reset. **Live feature validation: not run** means no claim is being made about an account's access, policy enforcement, native app automation, paid inference, remote memory, or cloud execution.

```powershell
npm run demo:verify -- computer-use
npm run demo:reset -- computer-use
```

`verify` checks the local output contract, not the identity or authenticity of a remote result. Inspect the live session/run trace separately. A manually copied JSON file cannot prove a real cloud or agentic run.

## Reset boundaries

Reset touches only marker-checked, manifest-listed files under `.demo-workspaces\<feature-id>`. Unknown files, missing markers in nonempty folders, symbolic links, and junctions cause it to stop. No broad recursive deletion is used. Close any editor/session using the workspace before reset; otherwise it could save its old buffer over the reset baseline.

**Local reset does not reset remote state.** Saved app approvals, cloud sessions/snapshots, durable workflow journals, server-side memories, PRs, and Actions logs have separate cleanup steps in each runbook. Never clear an account's memories, delete a session-state directory, or close unrelated runs/PRs to reset a demo.

## Presenter safety

- Use a disposable account/workspace approved for the pilot; close unrelated windows.
- Do not use real customer, financial, identity, production, or confidential information.
- Review effective policies and tool permissions; do not use `--allow-all`, `--allow-all-tools`, or permission bypass.
- A prompt is not a security boundary. Test deny controls in the actual tenant and platform.
- Stop on unavailable features, ambiguous targets, missing evidence, or failed controls.
- Treat preview terms, current pricing, and source freshness as part of the customer conversation.
