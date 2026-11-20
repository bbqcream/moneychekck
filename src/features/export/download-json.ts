import { serializePlanData } from "@/lib/storage/local";
import type { PlanData } from "@/types/plan-data";

export function downloadPlanJson(data: PlanData, filename: string) {
  const url = URL.createObjectURL(new Blob([serializePlanData(data)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
