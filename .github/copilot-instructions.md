# Copilot Runway contributor rules

This is independent public enablement content. Never add customer, personal, confidential, or credential data.

Use `catalog/features.json`, `catalog/sources.json`, and `readiness/gates.json` as the shared source of truth. Cite exact official GitHub sources and verified dates. Separate public preview, technical preview, experimental, GA, and unverified states. Dynamic Workflows (session SDK) and GitHub Agentic Workflows (Actions) are different capabilities.

Unknown, failed, missing, or stale required evidence blocks readiness. Never promote findings or verification dates merely because ingestion succeeded. Offline kit checks are not live feature/policy validation.

Write public documentation for quick scanning: lead with the point, use plain language and short sentences, and prefer focused headings, lists, and tables. Remove repetition, but preserve evidence, dates, lifecycle distinctions, caveats, safety boundaries, and actionable steps. Apply this standard to candidate proposals and all human-reviewed feature release docs, runbooks, and assessments. Do not compress away required controls or qualifications.

Use the Clawpilot CSS variables and Segoe UI/Aptos typography. The portal is a self-contained static Pages artifact with no runtime network calls or analytics. Escape all source/user strings; do not execute or trust external feed content.

Demo setup/reset may touch only known marker-checked synthetic files. Preserve unrelated files and reject symlinks/junctions. Never delete session stores, broad directories, account memories, or remote resources for reset.

Regenerate related briefs with `npm run artifacts`. Validate using `npm run check`, `npm run artifacts:check`, and `python scripts/verify_pptx.py`. Agentic workflow configuration requires the pinned `gh aw v0.86.2` compiler and a matching `.lock.yml`.
