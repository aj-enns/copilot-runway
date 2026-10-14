import { defineWorkflow, joinSession } from "@github/copilot-sdk/extension";
import { workflowDefinition } from "../../../demos/dynamic-workflows/workflow.mjs";

const workflow = defineWorkflow(workflowDefinition());
await joinSession({ workflows: [workflow] });
