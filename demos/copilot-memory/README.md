# Copilot Memory: a convention survives a new session

**8 minutes | Public preview | Facilitated demo | Kit-tested; no live memory**

## Prerequisites and scope

Requires a throwaway **presenter-owned GitHub repository**, approved Copilot identity, Memory permitted by policy, and an owner for cleanup. The kit creates no repository or account changes.

Memory is enabled per user, not per folder. Repository facts and user preferences have different scopes. Do not store personal preferences, customer facts, credentials, or confidential data.

## Prepare

```powershell
npm run demo:setup -- copilot-memory
npm run demo:rehearse -- copilot-memory
```

Copy the synthetic convention files into the approved throwaway repo using the normal reviewed workflow. Offline rehearsal normalizes a title but stores no memory.

## Present

1. Start the approved CLI in the throwaway repo. Inspect `/memory`, policy, and billing entity; do not enable a blocked capability.
2. Show `normalize-ticket.mjs`: the code lowercases a title and replaces spaces with hyphens.
3. Ask:

```text
Inspect normalize-ticket.mjs. The repository convention is that ticket IDs
are lowercase and hyphenated. If Memory is enabled and policy allows it,
capture only this non-sensitive repository fact with a real code citation.
Do not create a user-level preference. Show what was captured.
```

4. Inspect the stored repository fact and citation; a completion message is not proof.
5. Start a **new** session in that repo. Generate `ticket.json` from `Demo Ticket` using the convention; inspect the citation and output.
6. Copy only synthetic `ticket.json` to `.demo-workspaces\copilot-memory\ticket.json`.

## Verify and reset

```powershell
npm run demo:verify -- copilot-memory
npm run demo:reset -- copilot-memory
```

Expect `{"id":"demo-ticket"}`. Local output does not prove retrieval; inspect the session and settings.

With owner approval, delete **only** the demo fact in the throwaway repo's **Settings > Copilot > Memory** and confirm it's gone. Do not delete other memories or change global preferences. Local reset cannot delete server-side memory.

## Governance and failure

Unused facts expire after 28 days; validated use can renew the timer. Expiry is not immediate cleanup. Do not present repository facts as cross-repo knowledge. If storage or retrieval fails, say so.

Model interactions consume AI credits; no separate memory-storage price is established.

## Official sources

- https://docs.github.com/en/copilot/concepts/agents/copilot-memory
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/copilot-memory/manage-for-yourself
