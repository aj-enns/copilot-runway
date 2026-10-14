# Computer Use: a safer service-desk handoff

**8 minutes | Public preview | Native Windows/macOS app | Kit-tested; live feature not run**

## Customer story

A legacy support workflow has no useful API. Show the agent reading a native app, requesting narrowly scoped app access, making two controlled edits, and stopping. Do not present this as unattended production automation.

## Prerequisites

An eligible, approved Copilot seat; current approved CLI; a local Windows or macOS session; an installed native text editor; enterprise `features.computerUse` permitted; and synthetic content only. macOS may require Accessibility and Screen Recording permissions. A cloud/Linux session is not a substitute.

## Prepare

From the Runway repository root:

```powershell
npm run demo:setup -- computer-use
```

Copy the printed absolute workspace path. Open **only** its `support-brief.txt` in Notepad on Windows, or a plain-text native editor on macOS. Use the editor's normal Open command. Close unrelated documents and windows. Start `copilot` from the printed workspace path in a separate terminal.

```text
/computer show
/computer on
/permissions show
```

Record the prior computer-use setting. If policy blocks the feature, show the denial and stop the live demo. Grant only session-scoped access to the intended editor; do not select **Always allow**.

## Present

1. Show the ticket, `Status: Draft`, and `Next step: Unassigned`.
2. Explain that a more direct API/filesystem tool would normally be preferred, but this demonstration intentionally evaluates the native UI interaction.
3. Give Copilot this exact outcome and boundary:

```text
Use Computer Use to interact with the native text editor containing support-brief.txt.
Inspect the document first. Change only 'Status: Draft' to 'Status: Ready for pilot'
and 'Next step: Unassigned' to 'Next step: Validate policy in test tenant.'
Save only this synthetic document to its existing path.
Do not access other apps, send anything, change permissions, or use shell/filesystem
tools to perform the edits. Stop if the target app or document is ambiguous.
```

4. Observe the target app and tool calls. Demonstrate **Esc twice** to interrupt before a write if the target is wrong. Do not claim success if the agent used a file-writing tool instead of the app UI.
5. Review the saved document and the session's action trace. No message or external form should have been submitted.

## Verify and reset

Close the editor's demo document after saving. From the Runway root:

```powershell
npm run demo:verify -- computer-use
npm run demo:reset -- computer-use
npm run demo:reset -- computer-use
```

Verification requires the entire text to match the baseline with exactly those two edits; Windows CRLF and LF line endings are both accepted. Reopen the file after reset; it must be back to Draft and Unassigned. Local verification does not prove that UI tools made the changes; inspect the live trace.

Restore the previous computer-use setting. If it was off:

```text
/computer off
/computer show
```

Review saved app approvals separately if one was accidentally created. Removing a saved approval does not revoke an already active session. Do not change OS permissions automatically.

## Failure and cost discussion

If the app is ambiguous, inaccessible, or unavailable, stop and explain the limitation. The browser flight lab is a synthetic rehearsal, not a fallback that demonstrates Computer Use.

Current enterprise CLI usage consumes AI credits. The reviewed feature docs do not establish a separate GUI-action tariff. Measure the real rehearsal; do not promise a fixed per-demo cost.

## Official sources

- https://docs.github.com/en/copilot/concepts/agents/computer-use
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/computer-use
- https://docs.github.com/en/copilot/reference/enterprise-administrators/enterprise-managed-settings
- https://docs.github.com/en/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing
