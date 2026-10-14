# Enterprise readiness: the non-negotiables

The versioned source of truth is [gates.json](gates.json). The flight deck renders it directly, and every feature's generated Markdown assessment uses the same gate IDs and verdict rules.

This framework defines **minimum evidence for a controlled enterprise pilot**, not production certification, legal advice, an SLA, or approval for a particular customer's data.

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

**pass** means the cited mechanism or bounded kit behavior is documented. It does not prove that a customer's policy is configured or that its legal/security review is complete.

**conditional** means there is a documented route, but customer-specific validation, measurement, risk acceptance, or named approval remains.

**unknown** means required evidence is absent. **fail** means known evidence does not satisfy the requirement. A missing finding is unknown, never an implicit pass.

The shared evaluator applies these rules:

1. Any required fail, unknown, missing, or stale evidence yields **Hold for evidence**.
2. Otherwise, any required conditional finding yields **Pilot with conditions**.
3. Only all-current required passes yield **Pilot gates satisfied**. Preview acceptance and actual tenant sign-off are still required.

Evidence is stale after **30 days**. Failed ingestion does not overwrite a known-good snapshot. A successful scan does not extend a feature's or source's last-verified date.

## Add or change a non-negotiable

Edit `readiness/gates.json`. Give the gate a stable kebab-case ID, a question, named owner role, evidence requirement, and measurable acceptance test. Required defaults should remain explicit. Add an assessment for the new gate to **every** entry in `catalog/features.json`, using unknown until evidence exists.

For a semantic change, increment the rubric version and reassess every affected feature. Regenerate briefs/assessments with `npm run artifacts`, run `npm run check`, and submit the change for maintainer review.

The Pages **Readiness gates** workspace also accepts local proposed requirements and exports JSON. These additions remain browser-only proposals; they do not change repository policy or promote existing findings.

## Customer sign-off

Use [assessment-template.md](assessment-template.md) to record tenant/platform scope, exact client versions, test evidence, unresolved gaps, accountable owner roles, budget assumptions, preview acceptance, and the decision date. Keep customer-specific, personal, or confidential evidence **out of this repository and its public Pages output**.
