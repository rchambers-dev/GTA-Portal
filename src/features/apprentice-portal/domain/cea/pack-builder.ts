import type {
  CeaGroupDef,
  CeaGatewayItem,
  CeaMilestoneDef,
  CeaPackDef,
  CeaSupportItem,
  CeaTaskDef,
} from "./types";

/** Build a CEA task with no KSB / IMI refs (Jon maps later). */
export function ceaTask(
  groupId: string,
  number: number,
  title: string,
  opts?: { alwaysMandatory?: boolean },
): CeaTaskDef {
  return {
    id: `${groupId}-t${number}`,
    groupId,
    number,
    title,
    alwaysMandatory: opts?.alwaysMandatory,
  };
}

export function ceaGroup(input: {
  id: string;
  milestoneId: string;
  number: number;
  title: string;
  mandatoryRequired: number;
  milestoneWeightPercent: number;
  courseWeightPercent?: number;
  yearLabel: "Year 1" | "Year 2" | "Year 3";
  phaseLabel: string;
  knowledgeTestNote?: string;
  tasks: CeaTaskDef[];
}): CeaGroupDef {
  return input;
}

export function ceaMilestone(input: CeaMilestoneDef): CeaMilestoneDef {
  return input;
}

export function ceaGateway(input: CeaGatewayItem): CeaGatewayItem {
  return input;
}

/** Deep-clone a pack and strip every KSB / imiRefs mapping. */
export function stripPackKsbs(pack: CeaPackDef): CeaPackDef {
  return {
    ...pack,
    groups: pack.groups.map((group) => ({
      ...group,
      tasks: group.tasks.map((task) => {
        if (!task.relatedTeaching) return { ...task };
        const { relatedTeaching, ...rest } = task;
        // Keep teaching label/module hints if present, but never KSB codes.
        if (!relatedTeaching.label && !relatedTeaching.moduleId) {
          return rest;
        }
        return {
          ...rest,
          relatedTeaching: {
            moduleId: relatedTeaching.moduleId,
            topicId: relatedTeaching.topicId,
            label: relatedTeaching.label,
            imiRefs: [],
            needsStaffConfirm: relatedTeaching.needsStaffConfirm,
          },
        };
      }),
    })),
  };
}

/** Clone pack metadata for another Skills England version (same structure). */
export function clonePackForVersion(
  pack: CeaPackDef,
  standardVersion: string,
  opts?: { id?: string; title?: string },
): CeaPackDef {
  const stripped = stripPackKsbs(pack);
  return {
    ...stripped,
    id: opts?.id ?? `${pack.id}-v${standardVersion.replace(/^v/i, "")}`,
    title: opts?.title ?? pack.title,
    version: standardVersion.replace(/^v/i, ""),
  };
}

export function emptySupportItems(): CeaSupportItem[] {
  return [];
}
