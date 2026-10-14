# Autopilot: fix the bug, not the test

**6 minutes | Experimental mode | Disposable local code | Kit-tested; live agent not run**

## Prerequisites

An approved current CLI, experimental mode allowed, effective least-privilege permissions, and supported local sandboxing. Do not use a home directory, real customer repository, or permission-bypass/allow-all mode.

## Reproduce the symptom

From the Runway repository root:

```powershell
npm run demo:setup -- autopilot
npm run demo:verify -- autopilot
```

The second command must **fail**: the seeded implementation subtracts the percentage as a currency value and accepts invalid inputs. This intentional failure belongs only to the disposable fixture, not the repository test suite.

## Present

Copy the printed absolute workspace path, change to it, and start:

```powershell
copilot --experimental
```

Inside the CLI:

```text
/permissions show
/sandbox enable
```

Record previous settings. If required sandboxing cannot be enforced on this host, stop; do not bypass it. Use Shift+Tab to inspect modes and choose Autopilot, or use `/autopilot` on the verified client.

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

Observe the repair/test loop, inspect the diff, and show that the acceptance tests have not changed. A completion message is not the required result.

## Verify and reset

Stop the CLI session before resetting. From the Runway root:

```powershell
npm run demo:verify -- autopilot
npm run demo:reset -- autopilot
npm run demo:verify -- autopilot
```

The final verification must fail again: the baseline bug has been restored. The verifier also fails if the original test file was changed. Reset touches only marked synthetic files.

Return the CLI to its previous mode and sandbox settings if the demo changed them. Do not disable an enterprise-enforced control. No remote state is created by this kit.

## Cost and limitations

Autonomy can increase token usage, retries, and time. Current enterprise billing is AI credits; the CLI README's legacy premium-request statement is not used here as current enterprise pricing. Meter a bounded rehearsal and validate tenant budgets.

## Official sources

- https://github.com/github/copilot-cli/blob/76c3172eb38f5e7537b90b9800a7023d81156438/README.md
- https://github.com/github/copilot-cli/releases/tag/v1.0.97
- https://docs.github.com/en/copilot/concepts/security-governance-and-network-settings/about-cloud-and-local-sandboxes
- https://docs.github.com/en/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing
