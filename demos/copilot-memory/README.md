# Copilot Memory: a convention survives a new session

**8 minutes | Public preview | Facilitated demo | Kit-tested; live memory not created**

## Prerequisites and scope

Use a throwaway **GitHub repository owned by the presenter**, an approved Copilot identity, Memory permitted by policy, and a clear repository owner for cleanup. This kit does not create a repository or change account settings.

Memory enablement is per user, not per demo folder. Repository facts and user preferences have different sharing and ownership. Store no personal preference, customer fact, credential, or confidential information for this demo.

## Prepare

```powershell
npm run demo:setup -- copilot-memory
npm run demo:rehearse -- copilot-memory
```

Copy the two synthetic convention files into the presenter's already approved throwaway repository using the normal reviewed workflow. The local rehearsal normalizes a title but stores no memory.

## Present

1. In the throwaway repository, start the approved CLI, inspect `/memory`, and confirm effective policy and the selected billing entity. Do not enable a blocked capability.
2. Show `normalize-ticket.mjs`: the code lowercases a title and replaces spaces with hyphens.
3. Ask:

```text
Inspect normalize-ticket.mjs. The repository convention is that ticket IDs
are lowercase and hyphenated. If Memory is enabled and policy allows it,
capture only this non-sensitive repository fact with a real code citation.
Do not create a user-level preference. Show what was captured.
```

4. Inspect the actual repository memory and its citation. A completion message is not evidence of storage.
5. Start a **new** session in the same throwaway repository. Ask for `ticket.json` from synthetic title `Demo Ticket` using the validated repository convention. Inspect the retrieved fact/citation and output.
6. Copy only the synthetic `ticket.json` to `.demo-workspaces\copilot-memory\ticket.json` in Runway.

## Verify and reset

```powershell
npm run demo:verify -- copilot-memory
npm run demo:reset -- copilot-memory
```

The local result must contain `{"id":"demo-ticket"}`. Local output is not proof that a memory was retrieved; inspect the live session and settings.

With the repository owner's specific authorization, navigate to the **throwaway repository's Settings > Copilot > Memory** and delete **only** the exact demo fact. Confirm it is absent. Do not delete unrelated memories or change the user's global preference to simulate cleanup. Local reset does not delete server-side memories.

## Governance and failure

Unused facts expire after 28 days; validated use can renew that timer. Expiry is not an immediate reset mechanism. Facts from one repository must not be presented as cross-repository knowledge. If no fact was stored/retrieved, show that limitation instead of claiming persistence.

Underlying model interactions consume AI credits. No standalone memory-storage price is established by this assessment.

## Official sources

- https://docs.github.com/en/copilot/concepts/agents/copilot-memory
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/copilot-memory/manage-for-yourself
