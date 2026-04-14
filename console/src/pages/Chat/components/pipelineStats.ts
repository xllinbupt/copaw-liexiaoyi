import type { JobPipelineView } from "../../../api/types";

export interface PipelineTabStats {
  lead: number;
  active: number;
  interviewing: number;
}

export type VisiblePipelineStatItem = {
  key: "lead" | "active" | "interviewing";
  label: string;
  value: number;
};

export function getPipelineTabStats(
  board: JobPipelineView | null,
): PipelineTabStats {
  const entries = board?.entries ?? [];
  return {
    lead: entries.filter((entry) => entry.system_stage === "lead").length,
    active: entries.filter((entry) => entry.system_stage === "active").length,
    interviewing: entries.filter(
      (entry) =>
        entry.system_stage === "interview" || entry.system_stage === "offer",
    ).length,
  };
}

export function getVisiblePipelineStatItems(
  stats: PipelineTabStats,
): VisiblePipelineStatItem[] {
  const items: VisiblePipelineStatItem[] = [
    { key: "lead", label: "线索", value: stats.lead },
    { key: "active", label: "推进中", value: stats.active },
    { key: "interviewing", label: "面试", value: stats.interviewing },
  ];
  return items.filter((item) => item.value > 0);
}
