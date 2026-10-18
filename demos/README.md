# Customer demo kits

Open the [Runway flight deck](https://aj-enns.github.io/copilot-runway/) and choose a feature's **Demo** tab. This repository and site are public; all inputs are synthetic.

Each kit includes prerequisites, a walkthrough, expected evidence, local verification, failure handling, and scoped reset. The browser flight lab and `demo:rehearse` are **offline rehearsals**, not product implementations.

## Shared preparation

Use Node.js 22 or newer and an approved, current Copilot CLI. From the repository root:

```powershell
npm ci
npm run demo:setup -- computer-use
```

Replace the ID with `dynamic-workflows`, `agentic-workflows`, `cloud-sandboxes`, `copilot-memory`, or `autopilot`. Setup prints the workspace path. Use it for later commands; never start Copilot in your home directory.

Scripts do not authenticate, create credentials, change policy, grant app access, invoke models, create cloud sessions, or dispatch workflows. Verify eligibility and authorization separately.

## Verification is deliberately split

**Kit-tested** means repository tests cover setup, acceptance checks, offline logic, failures, and reset. **Live feature validation: not run** means account access, policy, app automation, paid inference, remote memory, and cloud execution are unverified.

```powershell
npm run demo:verify -- computer-use
npm run demo:reset -- computer-use
```

`verify` checks local output shape, not remote authenticity. Inspect the live trace; copied JSON does not prove a cloud or agentic run.

## Reset boundaries

Reset touches only marker-checked, manifest-listed files under `.demo-workspaces\<feature-id>`. It stops on unknown files, missing markers in nonempty folders, symlinks, or junctions. Close editors and sessions first so they cannot overwrite the reset baseline.

**Local reset does not clear remote state.** App approvals, cloud sessions/snapshots, workflow journals, server-side memories, PRs, and Actions logs have separate cleanup steps. Never clear all memories, delete session-state directories, or close unrelated runs/PRs.

## Presenter safety

- Use an approved disposable account/workspace; close unrelated windows.
- Do not use real customer, financial, identity, production, or confidential information.
- Review effective policies and tool permissions. Never use `--allow-all`, `--allow-all-tools`, or permission bypass.
- A prompt is not a security boundary. Test deny controls in the actual tenant and platform.
- Stop on unavailable features, ambiguous targets, missing evidence, or failed controls.
- Discuss preview terms, current pricing, and source freshness.
