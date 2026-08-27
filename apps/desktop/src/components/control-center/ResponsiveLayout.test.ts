import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import runWorkspaceSource from "./RunWorkspace.vue?raw";
import connectionBarSource from "./ConnectionBar.vue?raw";
import taskQueueSource from "./TaskQueue.vue?raw";
import { fileURLToPath } from "node:url";

const styleSource = readFileSync(fileURLToPath(new URL("../../style.css", import.meta.url)), "utf8");

describe("Desktop responsive layout", () => {
  it("keeps RunWorkspace primary actions separate from overflow controls", () => {
    expect(runWorkspaceSource).toContain("cc-run-header-overflow");
    expect(runWorkspaceSource).toContain("cc-run-header__launch");
    expect(runWorkspaceSource).toContain("aria-label=\"Provider\"");
  });

  it("provides responsive sidebar and chrome hooks", () => {
    expect(connectionBarSource).toContain("cc-connectionbar__actions");
    expect(taskQueueSource).toContain("cc-task-secondary-meta");
    expect(styleSource).toContain("grid-template-columns: 260px minmax(0, 1fr) auto");
    expect(styleSource).toContain("cc-connectionbar__requirement");
  });
});
