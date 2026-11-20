import type { TimelineGroup } from "@/lib/calc/balance";
import type { Item } from "@/types/scenario";
import { TimelineView } from "./timeline-view";

export function MonthlySpending({ groups, onEdit, onMove }: {
  groups: TimelineGroup[];
  onEdit: () => void;
  onMove: (item: Item, eventId: string) => string | null;
}) {
  return (
    <section className="timeline mt-4" aria-labelledby="month-spending-title">
      <div className="section-header flex-wrap">
        <h2 id="month-spending-title">수입·지출 목록</h2>
        <button type="button" className="btn btn-secondary" onClick={onEdit}>수입·지출 편집</button>
      </div>
      {groups.length ? <TimelineView groups={groups} onMove={onMove} /> : (
        <div className="empty-panel"><p>이달에 등록한 입금이 없어요.</p></div>
      )}
    </section>
  );
}
