# Cloud Sandboxes: prove where execution happens

**8 minutes | Public preview + experimental CLI flag | Interactive Linux cloud session | Kit-tested; not live-tested**

## Prerequisites

Requires an approved identity, compatible CLI, enabled organization/enterprise **Cloud Sandbox access**, accepted network policy, and compute/model/storage budget. Managed access is disabled by default.

Confirm the **billable owner** first. Within a Git repository, its owner is billed; outside one, choose an approved owner. This workspace is inside Runway's repository and could bill its organization. To select another owner, use an approved synthetic directory outside any Git repo.

## Prepare locally

```powershell
npm run demo:setup -- cloud-sandboxes
npm run demo:rehearse -- cloud-sandboxes
```

Offline rehearsal reports **local** execution, creates no remote resource, and cannot pass live verification.

## Present the live feature

After approval, start from the printed synthetic workspace:

```powershell
copilot --cloud --experimental
```

Cloud CLI sessions are interactive; do not use `-p` or `-i`. This demo needs no private repo, customer data, secrets, or package downloads.

1. Confirm that this is a cloud-backed session and inspect the remote Linux environment.
2. Give Copilot this bounded prompt:

```text
In this cloud sandbox, create sandbox-proof.json with:
{"platform":"linux","execution":"remote","sum":10}
Calculate the sum of [2,3,5] and inspect the actual platform before writing it;
do not merely copy the expected result if the environment differs.
Use no secrets, private repositories, network downloads, or external services.
Show the environment and file. Do not stop/delete/change any cloud resource
until I explicitly approve cleanup.
```

3. Inspect the tool trace and remote environment; JSON alone does not prove isolation.
4. Copy the synthetic result to `.demo-workspaces\cloud-sandboxes\sandbox-proof.json`.
5. Review inherited egress controls. Use an approved target for firewall tests; never invent a customer endpoint.

## Verify and reset

```powershell
npm run demo:verify -- cloud-sandboxes
npm run demo:reset -- cloud-sandboxes
```

Local verification checks only the output contract. Stop the exact remote session and inspect its snapshot. Snapshot deletion needs separate authorization; local reset does not stop compute or remove storage.

## Cost discussion

Reviewed rates: compute USD 0.000024/second, memory USD 0.000003/GiB-second, snapshot storage USD 0.005/GiB-month, plus model usage.

At 4 GiB for 60 minutes: compute 0.0864 + memory 0.0432 = **USD 0.1296**, before AI and snapshot costs. This allocation is illustrative, not a promised SKU. Check Cost lab and tenant meters.

Cloud spend needs its own product/SKU budget and approved **Stop usage when budget limit is reached** setting. AI-credit budgets do not cap compute/storage. The preview trial ended July 2026; no free allowance is assumed for this October 2026 assessment.

## Failure

If access or budget is unavailable, show the denial and stop. Do not present a local OS sandbox as cloud execution.

## Official sources

- https://docs.github.com/en/copilot/concepts/security-governance-and-network-settings/about-cloud-and-local-sandboxes
- https://docs.github.com/en/billing/concepts/product-billing/cloud-and-local-sandboxes
