import { describe, expect, it } from "vitest";
import source from "./RunWorkspace.vue?raw";

describe("RunWorkspace execution context toggle", () => {
  it("renders a controllable collapsed context by default", () => {
    expect(source).toContain("const showRunContext = ref(false)");
    expect(source).toContain(':aria-expanded="showRunContext"');
    expect(source).toContain('<div v-if="showRunContext" class="cc-run-context__body">');
    expect(source).toContain("showRunContext ? 'Thu gọn' : 'Chi tiết'");
  });

  it("keeps the summary identity visible and makes stepper details contextual", () => {
    expect(source).toContain("{{ displayModelName }} · {{ displayDirectory");
    expect(source).toContain(":details=\"showRunContext ? flowState.details : undefined\"");
  });
});
