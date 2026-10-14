# Cloud Sandboxes: prove where execution happens

**8 minutes | Public preview + experimental CLI flag | Interactive Linux cloud session | Kit-tested; live feature not run**

## Prerequisites

An approved identity, compatible Copilot CLI, organization/enterprise **Cloud Sandbox access** enabled, accepted cloud-agent network policy, and an approved compute/model/storage budget. Managed access is disabled by default.

Confirm the **billable owner** before starting. Within a Git repository, the repository owner is billed automatically; outside a repository, choose an explicitly approved owner when prompted. The local workspace is inside Runway's Git repository, so launching there can bill Runway's organization. Use an approved separate synthetic working directory outside any Git repository if you need the owner-selection flow.

## Prepare locally

```powershell
npm run demo:setup -- cloud-sandboxes
npm run demo:rehearse -- cloud-sandboxes
```

The offline result explicitly reports **local** execution and creates no remote resource. It cannot pass live-result verification.

## Present the live feature

From the printed synthetic workspace, and only after cloud usage is approved:

```powershell
copilot --cloud --experimental
```

Do not use `-p` or `-i`: cloud CLI sessions are interactive only. No private repository, customer data, secret, or package download is needed for this demo.

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

3. Inspect the tool trace and remote environment; JSON alone is not proof of isolation.
4. Copy only the synthetic result to local `.demo-workspaces\cloud-sandboxes\sandbox-proof.json`.
5. Review the inherited cloud-agent egress controls. A firewall negative test requires its own approved target; do not invent a reachable customer endpoint.

## Verify and reset

```powershell
npm run demo:verify -- cloud-sandboxes
npm run demo:reset -- cloud-sandboxes
```

Local verification checks the result contract only. Ask the operator to stop the exact remote session and inspect its snapshot. Deleting a snapshot is a separate, specifically authorized action. Local reset does not stop cloud compute or remove cloud storage.

## Cost discussion

Official reviewed rates: compute USD 0.000024/second, allocated memory USD 0.000003/GiB-second, snapshot storage USD 0.005/GiB-month, plus model usage.

Assuming 4 GiB for 60 minutes: compute 0.0864 + memory 0.0432 = **USD 0.1296**, before AI usage and stored snapshots. The allocation is an assumption, not a promised SKU. Use the flight deck's Cost lab and inspect the real tenant meters.

Cloud sandbox spend needs its own product/SKU budget and an approved **Stop usage when budget limit is reached** setting; bundled AI-credit budgets do not cap sandbox compute/storage. The source's preview trial entitlement ended in July 2026 and is not assumed for this October 2026 assessment.

## Failure

If access is disabled, the feature is unavailable, or budget is not approved, show the denial and stop. Do not substitute a local OS sandbox and describe it as cloud execution.

## Official sources

- https://docs.github.com/en/copilot/concepts/security-governance-and-network-settings/about-cloud-and-local-sandboxes
- https://docs.github.com/en/billing/concepts/product-billing/cloud-and-local-sandboxes
