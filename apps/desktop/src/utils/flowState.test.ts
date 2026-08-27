import { describe, expect, it } from "vitest";
import { deriveFlowState } from "./flowState";

describe("deriveFlowState", () => {
  it("maps the default state to ready", () => {
    expect(deriveFlowState({ phase: "Ready", runStatus: "idle" })).toMatchObject({ currentStep: "ready", state: "idle" });
  });

  it("keeps approvals and unavailable CAO in preflight", () => {
    expect(deriveFlowState({ phase: "Awaiting human approval", approvalPending: true, caoAvailable: true })).toMatchObject({ currentStep: "preflight", state: "waiting" });
    expect(deriveFlowState({ phase: "waiting_input" })).toMatchObject({ currentStep: "preflight", state: "waiting" });
    expect(deriveFlowState({ phase: "Ready", caoAvailable: false })).toMatchObject({ currentStep: "preflight", state: "blocked" });
  });

  it("maps CAO execution and failures", () => {
    expect(deriveFlowState({ phase: "Running", runStatus: "running", executionRoute: "cao" })).toMatchObject({ currentStep: "running", state: "active" });
    expect(deriveFlowState({ phase: "Run failed", runStatus: "failed" })).toMatchObject({ currentStep: "running", state: "error" });
    expect(deriveFlowState({ phase: "Run cancelled", runStatus: "cancelled" })).toMatchObject({ currentStep: "running", state: "cancelled" });
    expect(deriveFlowState({ phase: "Epic blocked by task dependencies", runStatus: "idle" })).toMatchObject({ currentStep: "preflight", state: "blocked" });
  });

  it("maps review and handoff precedence", () => {
    expect(deriveFlowState({ phase: "Independent review 1/3", runStatus: "completed", autoReviewStatus: "reviewing" })).toMatchObject({ currentStep: "review", state: "active" });
    expect(deriveFlowState({ phase: "Run completed — ready for handoff", runStatus: "completed" })).toMatchObject({ currentStep: "handoff", state: "complete" });
  });
});
