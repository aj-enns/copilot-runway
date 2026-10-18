# Feature assessment template

Use in the customer's approved evidence system, not this public repository.

## Scope

- Feature and exact official lifecycle:
- Primary sources and verified date:
- Tenant, allowed data classification, supported platform:
- Exact client/SDK/compiler versions:
- Named pilot owner and expiry/review date:
- Account eligibility and effective policies:

## Required gates

Use every stable ID in `readiness/gates.json`. Record the finding (`pass`, `conditional`, `unknown`, `fail`), official mechanism, tenant evidence, test result, owner, action, and due date.

Unknowns and failures block required gates; do not average them away. Distinguish customer observations from vendor documentation.

## Value and cost

Record the outcome, baseline, success measure, licensing, AI/model assumptions, agents/retries, Actions, compute, memory, storage, budgets, and observed use. Distinguish runtime limits from hard spending controls.

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

Passing fixture checks does not imply production readiness.
