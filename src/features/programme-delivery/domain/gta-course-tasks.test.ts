import { describe, expect, it, vi } from "vitest";
import {
  draftAndFormToUpsert,
  newForkedTaskKey,
  recordToTaskDraft,
  type GtaCourseTaskRecord,
} from "./gta-course-tasks";
import { copyCourseTasksForFork } from "./gta-course-tasks-repository";
import {
  applyCourseTasksFromDb,
  getAuthoredTaskForm,
  listBlockTaskDrafts,
} from "./course-builder-store";
import { defaultAuthoredTaskForm } from "./form-modules";

function sampleRecord(
  overrides: Partial<GtaCourseTaskRecord> = {},
): GtaCourseTaskRecord {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    programmeVersionId: "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv1",
    spineItemId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
    taskKey: "cb-task-one",
    sequence: 1,
    taskNumber: 1,
    kind: "practical",
    title: "Inspect brakes",
    scenario: "Bay 2",
    objectives: ["Safe lift"],
    instructions: ["Chock wheels"],
    knowledgeQuestions: ["Why chock?"],
    estimatedMinutes: 45,
    blockOrdinal: 2,
    form: {
      title: "Inspect brakes",
      scenario: "Bay 2 form",
      status: "ready",
      modules: [{ id: "m1", key: "notes", type: "textarea", label: "Notes" }],
    },
    publishStatus: "published",
    copiedFromTaskId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function sourceDbRow(args: {
  sourceId: string;
  oldBlock: string;
  taskKey: string;
  id: string;
}) {
  return {
    id: args.id,
    programme_version_id: args.sourceId,
    spine_item_id: args.oldBlock,
    task_key: args.taskKey,
    sequence: 1,
    task_number: 1,
    kind: "practical",
    title: "Inspect brakes",
    scenario: "Bay 2",
    objectives: ["Safe lift"],
    instructions: ["Chock wheels"],
    knowledge_questions: ["Why chock?"],
    estimated_minutes: 45,
    block_ordinal: 2,
    form_title: "Inspect brakes",
    form_scenario: "Bay 2 form",
    form_status: "ready",
    form_modules: [{ id: "m1", key: "notes", type: "textarea", label: "Notes" }],
    publish_status: "published",
    copied_from_task_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function thenable<T>(value: T) {
  return {
    then(resolve: (v: T) => void) {
      resolve(value);
    },
  };
}

function listBuilder(rowsForVersion: (id: string) => unknown[]) {
  return {
    select() {
      return {
        eq(_col: string, id: string) {
          const result = { data: rowsForVersion(id), error: null };
          const chain = {
            order() {
              return chain;
            },
            then(resolve: (v: unknown) => void) {
              resolve(result);
            },
          };
          return chain;
        },
      };
    },
  };
}

describe("gta course task_key semantics", () => {
  it("task_key maps to draft.id (version-scoped client identity)", () => {
    const row = sampleRecord();
    const draft = recordToTaskDraft(row);
    expect(draft.id).toBe(row.taskKey);
    expect(draft.programmeVersionId).toBe(row.programmeVersionId);
    expect(draft.spineBlockId).toBe(row.spineItemId);

    const upsert = draftAndFormToUpsert(draft, row.form, "draft");
    expect(upsert.taskKey).toBe(draft.id);
    expect(upsert.publishStatus).toBe("draft");
  });

  it("forked task_key is new and not equal to source (not cross-version)", () => {
    const source = "cb-orig-block-task";
    const a = newForkedTaskKey(source);
    expect(a).not.toBe(source);
    expect(a.startsWith("cb-fork-")).toBe(true);
  });
});

describe("applyCourseTasksFromDb hydrate precedence", () => {
  it("DB tasks replace stale local cache for that version only", () => {
    const versionId = "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv1";
    applyCourseTasksFromDb(versionId, [
      sampleRecord({
        taskKey: "stale",
        title: "Stale local",
        form: defaultAuthoredTaskForm("Stale local"),
      }),
    ]);
    applyCourseTasksFromDb(versionId, [
      sampleRecord({
        taskKey: "from-db",
        title: "From DB",
        form: {
          ...defaultAuthoredTaskForm("From DB"),
          status: "ready",
        },
      }),
    ]);

    const drafts = listBlockTaskDrafts(versionId);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.id).toBe("from-db");
    expect(drafts[0]!.title).toBe("From DB");
    expect(getAuthoredTaskForm(versionId, "from-db").status).toBe("ready");
  });
});

describe("copyCourseTasksForFork", () => {
  it("copies all tasks with remapped blocks, new keys, draft publish, lineage", async () => {
    const sourceId = "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv1";
    const targetId = "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv2";
    const oldBlock = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";
    const newBlock = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2";
    const sourceTaskId = "11111111-1111-1111-1111-111111111111";
    const inserted: Array<Record<string, unknown>> = [];

    const supabase = {
      from(table: string) {
        if (table === "gta_course_tasks") {
          return {
            ...listBuilder((id) =>
              id === sourceId
                ? [
                    sourceDbRow({
                      sourceId,
                      oldBlock,
                      taskKey: "cb-source",
                      id: sourceTaskId,
                    }),
                  ]
                : inserted.map((r) => ({
                    ...r,
                    created_at: "2026-01-01T00:00:00.000Z",
                    updated_at: "2026-01-01T00:00:00.000Z",
                  })),
            ),
            insert(rows: Array<Record<string, unknown>>) {
              inserted.push(...rows);
              return thenable({ error: null });
            },
          };
        }
        if (table === "gta_spine_items") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: newBlock,
                    item_type: "block",
                    spine_id: "spine-target",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { programme_version_id: targetId },
                error: null,
              }),
            }),
          }),
        };
      },
    };

    const copied = await copyCourseTasksForFork(supabase as never, {
      sourceProgrammeVersionId: sourceId,
      targetProgrammeVersionId: targetId,
      spineItemIdMap: { [oldBlock]: newBlock },
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.programme_version_id).toBe(targetId);
    expect(inserted[0]!.spine_item_id).toBe(newBlock);
    expect(inserted[0]!.task_key).not.toBe("cb-source");
    expect(inserted[0]!.copied_from_task_id).toBe(sourceTaskId);
    expect(inserted[0]!.publish_status).toBe("draft");
    expect(inserted[0]!.title).toBe("Inspect brakes");
    expect(inserted[0]!.form_status).toBe("ready");
    expect(copied).toHaveLength(1);
    expect(copied[0]!.programmeVersionId).toBe(targetId);
  });

  it("rejects missing spine mapping clearly", async () => {
    const sourceId = "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv1";
    const targetId = "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv2";
    const oldBlock = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";

    const supabase = {
      from(table: string) {
        if (table !== "gta_course_tasks") throw new Error(table);
        return listBuilder((id) =>
          id === sourceId
            ? [
                sourceDbRow({
                  sourceId,
                  oldBlock,
                  taskKey: "cb-source",
                  id: "11111111-1111-1111-1111-111111111111",
                }),
              ]
            : [],
        );
      },
    };

    await expect(
      copyCourseTasksForFork(supabase as never, {
        sourceProgrammeVersionId: sourceId,
        targetProgrammeVersionId: targetId,
        spineItemIdMap: {},
      }),
    ).rejects.toThrow(/Missing spine item mapping/);
  });

  it("does not update or delete source-version rows", async () => {
    const mutations: string[] = [];
    const sourceId = "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv1";
    const targetId = "vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvv2";
    const oldBlock = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";
    const newBlock = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2";

    const supabase = {
      from(table: string) {
        if (table === "gta_course_tasks") {
          return {
            ...listBuilder((id) =>
              id === sourceId
                ? [
                    sourceDbRow({
                      sourceId,
                      oldBlock,
                      taskKey: "cb-source",
                      id: "11111111-1111-1111-1111-111111111111",
                    }),
                  ]
                : [],
            ),
            insert() {
              return thenable({ error: null });
            },
            update() {
              mutations.push("update");
              return { eq: () => thenable({ error: null }) };
            },
            delete() {
              mutations.push("delete");
              return { eq: () => thenable({ error: null }) };
            },
          };
        }
        if (table === "gta_spine_items") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: newBlock,
                    item_type: "block",
                    spine_id: "s",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { programme_version_id: targetId },
                error: null,
              }),
            }),
          }),
        };
      },
    };

    await copyCourseTasksForFork(supabase as never, {
      sourceProgrammeVersionId: sourceId,
      targetProgrammeVersionId: targetId,
      spineItemIdMap: { [oldBlock]: newBlock },
    });
    expect(mutations).toEqual([]);
  });
});

describe("course-builder tasks API contracts", () => {
  it("GET without programmeVersionId returns 400", async () => {
    vi.resetModules();
    vi.doMock("@/adapters/supabase/client", () => ({
      createSupabaseAdminClient: () => ({}),
    }));
    vi.doMock(
      "@/features/programme-delivery/domain/gta-course-tasks-repository",
      () => ({
        listCourseTasksForVersion: vi.fn(),
        upsertCourseTasks: vi.fn(),
        deleteCourseTask: vi.fn(),
      }),
    );
    const { GET } = await import(
      "@/app/api/management/course-builder/tasks/route"
    );
    const res = await GET(
      new Request("http://localhost/api/management/course-builder/tasks"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/programmeVersionId is required/i);
  });
});
