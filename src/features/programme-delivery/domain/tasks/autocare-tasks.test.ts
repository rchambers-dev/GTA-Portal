import { describe, expect, it } from "vitest";
import { AUTOCARE_BLOCKS } from "@/features/programme-delivery/domain/autocare-blocks";
import {
  AUTOCARE_PRACTICAL_TASKS,
  tasksForBlock,
} from "@/features/programme-delivery/domain/tasks";

/** All 12 programme blocks carry the 1–5 task spine (60 total). */
const taskedBlocks = AUTOCARE_BLOCKS;

describe("Autocare task data", () => {
  it("covers every programme block with tasks 1 to 5", () => {
    for (const block of taskedBlocks) {
      const numbers = tasksForBlock(block.id)
        .map((t) => t.taskNumber)
        .sort((a, b) => a - b);
      expect(numbers, `block ${block.id}`).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("totals 60 tasks (12 blocks × 5)", () => {
    expect(AUTOCARE_PRACTICAL_TASKS).toHaveLength(60);
  });

  it("assigns the expected kind to each task number", () => {
    const expected: Record<number, string> = {
      1: "knowledge_test",
      2: "job_card",
      3: "practical",
      4: "practical",
      5: "reflection",
    };
    for (const task of AUTOCARE_PRACTICAL_TASKS) {
      expect(task.kind, task.id).toBe(expected[task.taskNumber]);
    }
  });

  it("gives every block exactly one reflection so the unlock gate resolves", () => {
    for (const block of taskedBlocks) {
      const reflections = tasksForBlock(block.id).filter(
        (t) => t.kind === "reflection",
      );
      expect(reflections, `block ${block.id}`).toHaveLength(1);
    }
  });

  it("uses unique task ids", () => {
    const ids = AUTOCARE_PRACTICAL_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no empty sections and no duplicate field keys within a task", () => {
    for (const task of AUTOCARE_PRACTICAL_TASKS) {
      expect(task.sections.length, task.id).toBeGreaterThan(0);
      for (const section of task.sections) {
        expect(section.fields.length, `${task.id}/${section.id}`).toBeGreaterThan(0);
      }
      const keys = task.sections.flatMap((s) => s.fields.map((f) => f.key));
      expect(new Set(keys).size, `${task.id} duplicate field keys`).toBe(
        keys.length,
      );
    }
  });

  it("records a source PDF and evidence reference for every task", () => {
    for (const task of AUTOCARE_PRACTICAL_TASKS) {
      expect(task.sourcePdf, task.id).toMatch(/\.pdf$/);
      expect(task.evidenceRef.length, task.id).toBeGreaterThan(0);
    }
  });
});
