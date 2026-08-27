export type FlowStepId = "ready" | "preflight" | "running" | "review" | "handoff";
export type FlowStateTone = "idle" | "active" | "complete" | "waiting" | "blocked" | "error" | "cancelled";

export type FlowRunStatus = "idle" | "running" | "completed" | "failed" | "cancelled";
export type FlowAutoReviewStatus =
  | "idle"
  | "reviewing"
  | "changes_requested"
  | "approved"
  | "max_iterations"
  | "failed";

export type FlowStateInput = {
  phase?: string | null;
  runStatus?: FlowRunStatus | null;
  autoReviewStatus?: FlowAutoReviewStatus | null;
  approvalPending?: boolean;
  caoAvailable?: boolean;
  executionRoute?: "cao" | null;
};

export type FlowState = {
  currentStep: FlowStepId;
  state: FlowStateTone;
  label: string;
  details: string;
};

const labels: Record<FlowStepId, string> = {
  ready: "Sẵn sàng",
  preflight: "Kiểm tra trước chạy",
  running: "CAO đang chạy",
  review: "Review",
  handoff: "Handoff",
};

const includesAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

export const deriveFlowState = (input: FlowStateInput): FlowState => {
  const phase = (input.phase || "").trim().toLowerCase();
  const runStatus = input.runStatus || "idle";
  const autoReviewStatus = input.autoReviewStatus || "idle";

  const isHandoff = includesAny(phase, [
    "handoff",
    "submitted for hub",
    "backlog created",
    "synced",
    "ready for handoff",
  ]);
  const isReview =
    autoReviewStatus !== "idle" ||
    includesAny(phase, ["review", "changes requested", "human review"]);
  const isRunning =
    runStatus === "running" ||
    input.executionRoute === "cao" ||
    includesAny(phase, ["running", "starting", "implementation", "streaming", "testing"]);
  const isPreflight =
    Boolean(input.approvalPending) ||
    input.caoAvailable === false ||
    includesAny(phase, [
      "preflight",
      "approval",
      "waiting for hub",
      "waiting",
      "awaiting",
      "sandbox",
      "environment",
      "repair",
      "pairing",
      "context",
      "blocked",
      "dependenc",
    ]);

  let currentStep: FlowStepId = "ready";
  if (isHandoff) currentStep = "handoff";
  else if (isReview) currentStep = "review";
  else if (isRunning) currentStep = "running";
  else if (isPreflight) currentStep = "preflight";
  else if (runStatus !== "idle") currentStep = "running";

  let state: FlowStateTone = currentStep === "ready" ? "idle" : "active";
  if (
    input.approvalPending ||
    includesAny(phase, [
      "awaiting approval",
      "waiting for hub approval",
      "waiting input",
      "waiting_input",
      "human review required",
      "needs review",
      "submitted for hub",
    ])
  ) {
    state = "waiting";
  } else if (
    includesAny(phase, ["blocked", "unavailable", "needs repair", "required"]) ||
    (input.caoAvailable === false && currentStep === "preflight")
  ) {
    state = "blocked";
  } else if (runStatus === "cancelled") {
    state = "cancelled";
  } else if (runStatus === "failed" || includesAny(phase, ["failed", "error"])) {
    state = "error";
  } else if (
    currentStep === "handoff" &&
    !includesAny(phase, ["preparing", "submitting", "needs review"])
  ) {
    state = "complete";
  } else if (
    currentStep === "review" &&
    (autoReviewStatus === "approved" || includesAny(phase, ["approved"]))
  ) {
    state = "complete";
  } else if (runStatus === "completed" && currentStep === "running") {
    state = "complete";
  }

  const details =
    state === "waiting"
      ? "Đang chờ phê duyệt để tiếp tục."
      : state === "blocked"
        ? input.caoAvailable === false
          ? "CAO chưa sẵn sàng; hãy khởi động daemon rồi thử lại."
          : "Luồng đang bị chặn; xem thông báo hiện tại để xử lý."
      : state === "error"
          ? "Luồng gặp lỗi; kiểm tra chi tiết và thử lại khi đã xử lý nguyên nhân."
          : state === "cancelled"
            ? "Luồng đã bị huỷ; có thể khởi động lại khi sẵn sàng."
          : state === "complete"
            ? "Chặng này đã hoàn tất."
            : currentStep === "running"
              ? "Agent đang thực thi qua CAO session."
              : currentStep === "review"
                ? "Kết quả đang được kiểm tra trước khi handoff."
                : currentStep === "handoff"
                  ? "Kết quả sẵn sàng để gửi về Task Hub."
                  : currentStep === "preflight"
                    ? "Đang kiểm tra workspace, quyền và CAO runtime."
                    : "Chọn task và khởi động agent để bắt đầu.";

  return { currentStep, state, label: labels[currentStep], details };
};
