# Computer Use: a safer service-desk handoff

**8 minutes | Public preview | Native Windows/macOS app | Kit-tested; not live-tested**

## Customer story

Demonstrate two controlled edits in a native app when a legacy workflow has no useful API. This is not unattended production automation.

## Prerequisites

Requires an eligible Copilot seat, approved CLI, local Windows/macOS session, native text editor, permitted `features.computerUse`, and synthetic content. macOS may require Accessibility and Screen Recording permissions. Cloud/Linux is not a substitute.

## Prepare

From the Runway repository root:

```powershell
npm run demo:setup -- computer-use
```

Open **only** the printed workspace's `support-brief.txt` in Notepad (Windows) or a plain-text native editor (macOS). Use the editor's Open command, close unrelated windows, and start `copilot` from that path in a separate terminal.

```text
/computer show
/computer on
/permissions show
```

Record the prior setting. If policy blocks the feature, show the denial and stop. Grant session-only access to the editor; never select **Always allow**.

## Present

1. Show the ticket, `Status: Draft`, and `Next step: Unassigned`.
2. Note that APIs or filesystem tools are usually preferable; this demo specifically tests native UI interaction.
3. Give Copilot this exact outcome and boundary:

```text
Use Computer Use to interact with the native text editor containing support-brief.txt.
Inspect the document first. Change only 'Status: Draft' to 'Status: Ready for pilot'
and 'Next step: Unassigned' to 'Next step: Validate policy in test tenant.'
Save only this synthetic document to its existing path.
Do not access other apps, send anything, change permissions, or use shell/filesystem
tools to perform the edits. Stop if the target app or document is ambiguous.
```

4. Observe the app and tool calls. Press **Esc twice** to interrupt before a wrong-target write. Do not claim success if edits used a file tool instead of the UI.
5. Review the document and action trace. No message or external form should be submitted.

## Verify and reset

Close the editor's demo document after saving. From the Runway root:

```powershell
npm run demo:verify -- computer-use
npm run demo:reset -- computer-use
npm run demo:reset -- computer-use
```

Verification requires exactly those two edits; CRLF and LF are accepted. After reset, confirm Draft and Unassigned. Local checks do not prove UI use; inspect the live trace.

Restore the previous setting. If it was off:

```text
/computer off
/computer show
```

Review any saved app approval separately. Removing it does not revoke an active session. Do not change OS permissions automatically.

## Failure and cost discussion

If the app is ambiguous or unavailable, stop and explain. The browser lab is a rehearsal, not Computer Use.

Enterprise CLI usage consumes AI credits. No separate GUI-action price is established. Measure the run; do not promise a fixed demo cost.

## Official sources

- https://docs.github.com/en/copilot/concepts/agents/computer-use
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/computer-use
- https://docs.github.com/en/copilot/reference/enterprise-administrators/enterprise-managed-settings
- https://docs.github.com/en/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing
