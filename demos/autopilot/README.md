# Autopilot: fix the bug, not the test

**6 minutes | Experimental mode | Disposable local code | Kit-tested; not live-tested**

## Prerequisites

Use an approved current CLI, permitted experimental mode, least-privilege permissions, and supported local sandboxing. Never use a home directory, customer repo, or allow-all/bypass mode.

## Reproduce the symptom

From the Runway repository root:

```powershell
npm run demo:setup -- autopilot
npm run demo:verify -- autopilot
```

The second command must **fail**: the fixture subtracts a percentage as currency and accepts invalid inputs. This intentional failure is isolated from repository tests.

## Present

Change to the printed workspace path and start:

```powershell
copilot --experimental
```

Inside the CLI:

```text
/permissions show
/sandbox enable
```

Record prior settings. Stop if the host cannot enforce sandboxing. Use Shift+Tab to choose Autopilot or `/autopilot` on a verified client.

Give this objective:

```text
Work only in this synthetic workspace.
Fix discount.mjs so discount(120,25) is 90, discount(40,0) is 40,
and discount(40,100) is 0.
Reject non-finite or negative prices and percentages outside 0..100.
Do not modify discount.test.mjs, install dependencies, access the network,
use other directories, or commit/push.
Run node --test discount.test.mjs and stop only when all tests pass.
If policy or required sandboxing blocks a step, stop and explain; do not bypass it.
```

Inspect the repair/test loop and diff; confirm the acceptance tests are unchanged. A completion message is not proof.

## Verify and reset

Stop the CLI session before resetting. From the Runway root:

```powershell
npm run demo:verify -- autopilot
npm run demo:reset -- autopilot
npm run demo:verify -- autopilot
```

Final verification must fail again because reset restored the bug. It also fails if the test file changed. Reset touches only marked synthetic files.

Restore prior CLI and sandbox settings. Never disable enterprise-enforced controls. This kit creates no remote state.

## Cost and limitations

Autonomy can increase AI usage, retries, and runtime. Enterprise billing uses AI credits; the CLI README's legacy premium-request statement is not current pricing. Meter a bounded run and verify tenant budgets.

## Official sources

- https://github.com/github/copilot-cli/blob/76c3172eb38f5e7537b90b9800a7023d81156438/README.md
- https://github.com/github/copilot-cli/releases/tag/v1.0.97
- https://docs.github.com/en/copilot/concepts/security-governance-and-network-settings/about-cloud-and-local-sandboxes
- https://docs.github.com/en/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing
