import { describe, expect, it } from "vitest";
import {
  buildPublishedDeliveryCatalogue,
  taskByDeliveryId,
  tasksForDeliveryBlock,
} from "./published-delivery-catalogue";

const SPINE_A = "11111111-1111-1111-1111-111111111111";
const SPINE_B = "22222222-2222-2222-2222-222222222222";
const VERSION_V1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VERSION_V2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function spine(id: string, sequence: number, title: string, blockNumber: number) {
  return {
    id,
    itemType: "block",
    title,
    sequence,
    plannedOtjHours: 7,
    metadata: { blockNumber, weekStart: sequence * 4 - 3, weekEnd: sequence * 4 },
  };
}

function task(args: {
  taskKey: string;
  spineItemId: string;
  programmeVersionId: string;
  publishStatus: "draft" | "published";
  taskNumber: number;
  title: string;
  blockOrdinal: number;
}) {
  return {
    taskKey: args.taskKey,
    spineItemId: args.spineItemId,
    programmeVersionId: args.programmeVersionId,
    publishStatus: args.publishStatus,
    taskNumber: args.taskNumber,
    kind: "practical" as const,
    title: args.title,
    scenario: "Scenario",
    objectives: ["Do the work"],
    instructions: ["Step 1"],
    knowledgeQuestions: [],
    estimatedMinutes: 60,
    blockOrdinal: args.blockOrdinal,
  };
}

describe("buildPublishedDeliveryCatalogue", () => {
  it("requires an explicit programme version pin", () => {
    const cat = buildPublishedDeliveryCatalogue({
      programmeVersionId: null,
      spineItems: [spine(SPINE_A, 1, "Block 1", 1)],
      tasks: [],
    });
    expect(cat.status).toBe("unpinned");
    expect(cat.tasks).toHaveLength(0);
    expect(cat.message).toMatch(/Bind a programme version/i);
  });

  it("fails clearly when the pinned version is missing", () => {
    const cat = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V1,
      spineItems: [],
      tasks: [],
      versionExists: false,
    });
    expect(cat.status).toBe("version_missing");
    expect(cat.programmeVersionId).toBe(VERSION_V1);
  });

  it("returns empty_published when the pin has blocks but no published tasks", () => {
    const cat = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V1,
      programmeTitle: "Autocare clean",
      spineItems: [spine(SPINE_A, 1, "Induction", 1)],
      tasks: [
        task({
          taskKey: "cb-draft",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V1,
          publishStatus: "draft",
          taskNumber: 1,
          title: "Draft only",
          blockOrdinal: 1,
        }),
      ],
      versionExists: true,
    });
    expect(cat.status).toBe("empty_published");
    expect(cat.blocks).toHaveLength(1);
    expect(cat.tasks).toHaveLength(0);
  });

  it("loads only published tasks for the pinned version", () => {
    const cat = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V1,
      spineItems: [
        spine(SPINE_A, 1, "Block 1", 1),
        spine(SPINE_B, 2, "Block 2", 2),
      ],
      tasks: [
        task({
          taskKey: "v1-a1",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V1,
          publishStatus: "published",
          taskNumber: 2,
          title: "V1 A2",
          blockOrdinal: 1,
        }),
        task({
          taskKey: "v1-a0",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V1,
          publishStatus: "published",
          taskNumber: 1,
          title: "V1 A1",
          blockOrdinal: 1,
        }),
        task({
          taskKey: "v1-draft",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V1,
          publishStatus: "draft",
          taskNumber: 3,
          title: "Hidden draft",
          blockOrdinal: 1,
        }),
        task({
          taskKey: "v2-a1",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V2,
          publishStatus: "published",
          taskNumber: 1,
          title: "Other version",
          blockOrdinal: 1,
        }),
      ],
      versionExists: true,
    });

    expect(cat.status).toBe("ready");
    expect(cat.tasks.map((t) => t.id)).toEqual(["v1-a0", "v1-a1"]);
    expect(cat.tasks.every((t) => t.programmeVersionId === VERSION_V1)).toBe(
      true,
    );
    expect(taskByDeliveryId(cat, "v1-draft")).toBeUndefined();
    expect(taskByDeliveryId(cat, "v2-a1")).toBeUndefined();
  });

  it("isolates V1 and V2 task catalogues", () => {
    const sharedTasks = [
      task({
        taskKey: "shared-key",
        spineItemId: SPINE_A,
        programmeVersionId: VERSION_V1,
        publishStatus: "published",
        taskNumber: 1,
        title: "V1 task",
        blockOrdinal: 1,
      }),
      task({
        taskKey: "shared-key",
        spineItemId: SPINE_A,
        programmeVersionId: VERSION_V2,
        publishStatus: "published",
        taskNumber: 1,
        title: "V2 task",
        blockOrdinal: 1,
      }),
    ];
    const v1 = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V1,
      spineItems: [spine(SPINE_A, 1, "Block 1", 1)],
      tasks: sharedTasks,
      versionExists: true,
    });
    const v2 = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V2,
      spineItems: [spine(SPINE_A, 1, "Block 1", 1)],
      tasks: sharedTasks,
      versionExists: true,
    });
    expect(v1.tasks[0]?.title).toBe("V1 task");
    expect(v2.tasks[0]?.title).toBe("V2 task");
    expect(v1.tasks[0]?.programmeVersionId).not.toBe(
      v2.tasks[0]?.programmeVersionId,
    );
  });

  it("orders by spine sequence then taskNumber", () => {
    const cat = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V1,
      spineItems: [
        spine(SPINE_B, 2, "Second", 2),
        spine(SPINE_A, 1, "First", 1),
      ],
      tasks: [
        task({
          taskKey: "b2",
          spineItemId: SPINE_B,
          programmeVersionId: VERSION_V1,
          publishStatus: "published",
          taskNumber: 1,
          title: "B first",
          blockOrdinal: 2,
        }),
        task({
          taskKey: "a2",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V1,
          publishStatus: "published",
          taskNumber: 2,
          title: "A second",
          blockOrdinal: 1,
        }),
        task({
          taskKey: "a1",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V1,
          publishStatus: "published",
          taskNumber: 1,
          title: "A first",
          blockOrdinal: 1,
        }),
      ],
      versionExists: true,
    });
    expect(cat.blocks.map((b) => b.spineItemId)).toEqual([SPINE_A, SPINE_B]);
    expect(cat.tasks.map((t) => t.id)).toEqual(["a1", "a2", "b2"]);
    expect(
      tasksForDeliveryBlock(cat, SPINE_A).map((t) => t.id),
    ).toEqual(["a1", "a2"]);
  });

  it("uses spine_item_id as block identity (ordinal is display-only)", () => {
    const cat = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V1,
      spineItems: [spine(SPINE_A, 5, "Out of order ordinals", 99)],
      tasks: [
        task({
          taskKey: "t1",
          spineItemId: SPINE_A,
          programmeVersionId: VERSION_V1,
          publishStatus: "published",
          taskNumber: 1,
          title: "Task",
          blockOrdinal: 99,
        }),
      ],
      versionExists: true,
    });
    expect(cat.blocks[0]?.spineItemId).toBe(SPINE_A);
    expect(cat.blocks[0]?.displayOrdinal).toBe(99);
    expect(cat.tasks[0]?.spineItemId).toBe(SPINE_A);
    expect(cat.tasks[0]?.id).toBe("t1");
  });

  it("never invents Autocare fallback when published content is empty", () => {
    const cat = buildPublishedDeliveryCatalogue({
      programmeVersionId: VERSION_V1,
      spineItems: [spine(SPINE_A, 1, "Empty", 1)],
      tasks: [],
      versionExists: true,
    });
    expect(cat.status).toBe("empty_published");
    expect(cat.tasks).toEqual([]);
  });
});
