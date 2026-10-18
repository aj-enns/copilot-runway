# Enterprise readiness: the non-negotiables

The [gates.json](gates.json) source of truth drives the flight deck and every generated feature assessment.

This framework sets **minimum evidence for a controlled enterprise pilot**. It is not production certification, legal advice, an SLA, or customer-data approval.

## Ten required gates

| Gate | Minimum requirement | Accountable owner |
| --- | --- | --- |
| Documented availability | Exact stage, supported platform, eligible identity, and enablement path | Platform owner |
| Enforceable admin control | Disable/rollout control, no policy bypass, and a negative test | Enterprise administrator |
| Least-privilege identity | Attributable identity, narrow scopes, safe credentials, revocation | Identity and access |
| Approved data boundary | Classification, captures, model inputs, retention, deletion, residency | Privacy and security |
| Human control for impact | Explicit high-impact approval boundary, interruption, injection test | Business process owner |
| Traceable activity | Reconstruct inputs, actor, tool actions, outputs, approvals, retention | Security operations |
| Owned and bounded spend | Seats, AI usage, agents, Actions, compute, storage, overage controls | FinOps |
| Approved network path | Proxy/TLS behavior, endpoint/egress approval, platform-specific deny tests | Network security |
| Supported pilot operation | Preview acceptance, version inventory, support route, incident owner | Service owner |
| Reversible by design | Scoped local reset plus separate remote-state and approval cleanup | Demo/change owner |

## Findings are not a weighted score

**pass** means the mechanism or bounded kit behavior is documented—not that customer policy or legal/security review is complete.

**conditional** means a route is documented, but customer validation, measurement, risk acceptance, or approval remains.

**unknown** means evidence is missing. **fail** means it does not meet the requirement. Missing findings are unknown, never passes.

The shared evaluator applies these rules:

1. Any required fail, unknown, missing, or stale evidence means **Hold for evidence**.
2. Otherwise, any required conditional means **Pilot with conditions**.
3. Only current passes on all required gates mean **Pilot gates satisfied**. Preview acceptance and tenant sign-off still apply.

Evidence is stale after **30 days**. Failed ingestion preserves the last good snapshot. Successful scans never extend verification dates.

## Add or change a non-negotiable

Edit `readiness/gates.json` with a stable kebab-case ID, question, owner role, evidence requirement, and measurable test. Keep required defaults explicit. Add the gate to **every** feature in `catalog/features.json`, using unknown until evidence exists.

For semantic changes, increment the rubric version and reassess affected features. Regenerate briefs/assessments with `npm run artifacts`, run `npm run check`, and request maintainer review.

The Pages **Readiness gates** workspace exports local proposals as JSON; it does not change repository policy or promote findings.

## Customer sign-off

Use [assessment-template.md](assessment-template.md) to record scope, versions, evidence, gaps, owners, budget, preview acceptance, and decision date. Keep customer, personal, and confidential evidence **out of this public repository and Pages site**.
