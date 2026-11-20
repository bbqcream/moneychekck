import type { Timeline } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import { summarizePriorities } from "@/lib/calc/priorities";
import { spendingPriorities } from "@/types/scenario";
import { priorityLabels } from "./labels";

export function PrioritySummary({ timeline }: { timeline: Timeline }) {
  const totals = summarizePriorities(timeline);
  return (
    <details className="panel px-3 py-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">우선순위별 지출</summary>
      <dl className="divide-y divide-line text-sm" aria-label="우선순위별 지출 합계">
        {spendingPriorities.map((priority) => (
          <div key={priority} className="flex flex-wrap justify-between gap-2 py-2">
            <dt>{priorityLabels[priority]}</dt>
            <dd className="font-semibold">{formatRange(totals[priority])}만원</dd>
          </div>
        ))}
        {totals.unassigned.count > 0 && (
          <div className="flex flex-wrap justify-between gap-2 py-2">
            <dt>미지정</dt>
            <dd className="font-semibold">{formatRange(totals.unassigned)}만원</dd>
          </div>
        )}
      </dl>
    </details>
  );
}
