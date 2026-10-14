# Feature assessment template

Use in the customer's approved evidence system, not this public artifact set.

## Scope

- Feature and exact official lifecycle:
- Primary sources and verified date:
- Tenant, allowed data classification, supported platform:
- Exact client/SDK/compiler versions:
- Named pilot owner and expiry/review date:
- Account eligibility and effective policies:

## Required gates

Use every stable ID in `readiness/gates.json`. For each, record finding (`pass`, `conditional`, `unknown`, `fail`), official mechanism, actual tenant evidence, acceptance-test result, owner, unresolved action, and due date.

Unknowns and failures block required gates. Do not average them away. Customer observations must be distinguishable from vendor documentation.

## Value and cost

Record the specific outcome, baseline, measurable success criterion, licensing, model/AI-credit assumptions, parallel agents/retries, Actions, compute, memory, snapshot storage, budgets, and observed usage. Distinguish a soft runtime ceiling from a hard spending policy.

## Demo validation

- Synthetic setup:
- Expected output contract:
- Exact live run/session evidence:
- Policy negative test:
- Failure and interruption evidence:
- Local reset result:
- Saved app approval / memory / journal / snapshot / PR cleanup:

## Decision

Minimum pilot verdict:

Unresolved non-negotiables:

Security, privacy, identity, network, FinOps, service-owner approvals:

Preview/support risk acceptance:

Review/expiry date:

No production recommendation is implied by a kit passing its fixture checks.
