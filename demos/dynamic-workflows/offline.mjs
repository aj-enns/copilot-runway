import { workflowDefinition } from "./workflow.mjs";
import { applications } from "../fixtures.mjs";

export class ReviewCheckpoint extends Error {
  constructor(key) {
    super(`Human review required at ${key}`);
    this.name = "ReviewCheckpoint";
    this.key = key;
  }
}

export function rehearsalContext({ apps = applications, agent, journal = new Map(), reviewed = new Set() } = {}) {
  const observation = { calls: [], phases: [], logs: [] };
  const ctx = {
    args: { apps },
    runId: "offline-rehearsal-not-a-live-run",
    signal: new AbortController().signal,
    phase: (title) => observation.phases.push(title),
    log: (message) => observation.logs.push(message),
    step: async (key, producer) => {
      if (!journal.has(key)) journal.set(key, await producer());
      return journal.get(key);
    },
    pause: async (key) => {
      if (!reviewed.has(key)) throw new ReviewCheckpoint(key);
    },
    agent: async (prompt, options) => {
      observation.calls.push(options.label);
      if (agent) return agent(prompt, options);
      const app = apps.find((item) => options.label === `assess:${item.id}`);
      return { ...app, recommendation: app.audit ? "Review tenant-specific controls before a pilot." : "Enable approved audit before a pilot." };
    },
    pipeline: async (items, stage) => Promise.all(items.map(async (item, index) => {
      try {
        return await stage(undefined, item, index);
      } catch (error) {
        if (["AbortError", "ResponseError", "ConnectionError"].includes(error.name) ||
          error.code === "workflow_limit_reached") throw error;
        observation.logs.push(`Pipeline item failed: ${error.message}`);
        return null;
      }
    })),
  };
  return { ctx, observation, journal, reviewed };
}

export async function rehearseWorkflow(options = {}) {
  const state = rehearsalContext(options);
  let checkpoint;
  try {
    await workflowDefinition().run(state.ctx);
    throw new Error("Expected a human-review checkpoint");
  } catch (error) {
    if (!(error instanceof ReviewCheckpoint)) throw error;
    checkpoint = error.key;
  }
  const beforeResume = state.observation.calls.length;
  state.reviewed.add(checkpoint);
  const report = await workflowDefinition().run(state.ctx);
  if (state.observation.calls.length !== beforeResume) throw new Error("Resume unexpectedly reran journaled assessments");
  return { mode: "offline-rehearsal", report, observation: state.observation, checkpoint };
}
