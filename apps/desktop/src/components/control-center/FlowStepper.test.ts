import { describe, expect, it } from "vitest";
import source from "./FlowStepper.vue?raw";

describe("FlowStepper", () => {
  it("renders the five CAO stages and accessible current-step metadata", () => {
    expect(source).toContain("Sẵn sàng");
    expect(source).toContain("Kiểm tra trước chạy");
    expect(source).toContain("CAO đang chạy");
    expect(source).toContain("Review");
    expect(source).toContain("Handoff");
    expect(source).toContain("aria-current");
    expect(source).toContain("aria-live=\"polite\"");
  });
});

