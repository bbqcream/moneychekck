import { useState } from "react";
import { BalanceText } from "@/components/balance-text";
import type { TimelineGroup } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import type { Item, PayEvent } from "@/types/scenario";
import { ItemMoveDialog } from "./item-move-dialog";
import { kindLabels, monthlyRuleLabels, priorityLabels } from "./labels";
import { useItemDrag } from "./use-item-drag";

const monthlyItemLabels: Partial<Record<Item["kind"], string>> = {
  expense: monthlyRuleLabels.expense,
  saving: monthlyRuleLabels.saving,
  investment: "월 고정투자",
};

const kindEmoji: Record<Item["kind"], string> = {
  expense: "🛒",
  saving: "🐷",
  investment: "📈",
  debt: "🧾",
  transfer: "💸",
};

type TimelineEdits = {
  addItem: (event: PayEvent) => void;
  editEvent: (event: PayEvent) => void;
  deleteEvent: (event: PayEvent) => void;
  editItem: (event: PayEvent, item: Item) => void;
  deleteItem: (item: Item) => void;
  moveItem?: (item: Item, direction: -1 | 1) => void;
};

function EventGroup({ group, edits, drag, openMove }: {
  group: TimelineGroup;
  edits?: TimelineEdits;
  drag: ReturnType<typeof useItemDrag>;
  openMove?: (item: Item) => void;
}) {
  const { event, balance, amount, items, monthlySalary } = group;
  const taxChanged = amount.min !== event.amount.min || amount.max !== event.amount.max;
  const manual = items.filter(({ monthlyRuleId }) => !monthlyRuleId);
  const reorderItem = edits?.moveItem;
  return (
    <article className={"event-card" + (drag.targetId === event.id ? " ring-2 ring-brand" : "")} data-drop-event={event.id}>
      <div className="event-head">
        <div className="event-icon" aria-hidden="true">+</div>
        <div className="entry-main">
          <div className="entry-title">
            <h3>{event.label}</h3>
            <span className={"badge " + (event.certainty === "confirmed" ? "badge-good" : "badge-pending")}>
              {event.certainty === "confirmed" ? "확실" : "미정"}
            </span>
            {monthlySalary && <span className="badge badge-kind">고정 월급</span>}
          </div>
          <p className="meta">
            {event.date ?? "날짜 미정"} · 입금 {formatRange(event.amount)}만원
            {taxChanged && " · 세후 " + formatRange(amount) + "만원"}
          </p>
          {event.note && <p className="item-note">{event.note}</p>}
        </div>
        {edits && !monthlySalary && <div className="entry-actions">
          <button type="button" className="btn btn-quiet" aria-label={event.label + " 입금 수정"} onClick={() => edits.editEvent(event)}>수정</button>
          <button type="button" className="btn btn-quiet" aria-label={event.label + " 입금 삭제"} onClick={() => edits.deleteEvent(event)}>삭제</button>
        </div>}
        <div className="entry-balance event-balance">
          <span>입금 후 잔액</span>
          <BalanceText balance={balance} />
        </div>
      </div>
      {items.length > 0 && (
        <ol className="item-list">
          {items.map(({ item, amount, balance, monthlyRuleId, budgetDeferred }) => (
            <li className={"item-row" + (drag.draggedId === item.id ? " opacity-60" : "")} key={item.id}>
              <div className="entry-main">
                <div className="entry-title">
                  <h4>{item.label}</h4>
                  <span className="badge badge-kind gap-1">
                    <span aria-hidden="true">{kindEmoji[item.kind]}</span>
                    {(monthlyRuleId && monthlyItemLabels[item.kind]) || kindLabels[item.kind]}
                  </span>
                  {item.priority && <span className="badge badge-kind">{priorityLabels[item.priority]}</span>}
                  {budgetDeferred && <span className="badge badge-warn">예산 초과</span>}
                </div>
                <p className="meta">
                  계획 금액 {formatRange(amount)}만원
                  {item.repetition && (
                    " · " + formatRange(item.amount) + "만원 × " + item.repetition.count +
                    (item.repetition.unit === "daily" ? "일" : "개월")
                  )}
                </p>
                {item.note && <p className="item-note">{item.note}</p>}
              </div>
              {!monthlyRuleId && (openMove || edits) && <div className="entry-actions">
                {openMove && <button type="button" className="btn btn-quiet cursor-grab! touch-none select-none active:cursor-grabbing!"
                  aria-label={item.label + " 다른 입금으로 이동"} {...drag.handle(item, openMove)}>↔ 이동</button>}
                {reorderItem && manual.length > 1 && (
                  <>
                    <button type="button" className="btn btn-quiet order-button" aria-label={item.label + " 위로 이동"} disabled={item.id === manual[0].item.id} onClick={() => reorderItem(item, -1)}>↑</button>
                    <button type="button" className="btn btn-quiet order-button" aria-label={item.label + " 아래로 이동"} disabled={item.id === manual.at(-1)?.item.id} onClick={() => reorderItem(item, 1)}>↓</button>
                  </>
                )}
                {edits && <>
                  <button type="button" className="btn btn-quiet" aria-label={item.label + " 항목 수정"} onClick={() => edits.editItem(event, item)}>수정</button>
                  <button type="button" className="btn btn-quiet" aria-label={item.label + " 항목 삭제"} onClick={() => edits.deleteItem(item)}>삭제</button>
                </>}
              </div>}
              <div className="entry-balance">
                <span>항목 후 잔액</span>
                <BalanceText balance={balance} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {edits && <div className="event-footer">
        <button type="button" className="btn btn-secondary" aria-label={event.label + " 아래 항목 추가"} onClick={() => edits.addItem(event)}>+ 항목 추가</button>
      </div>}
    </article>
  );
}

export function TimelineView({ groups, edits, onMove }: {
  groups: TimelineGroup[];
  edits?: TimelineEdits;
  onMove: (item: Item, eventId: string) => string | null;
}) {
  const [moving, setMoving] = useState<Item>();
  const [notice, setNotice] = useState("");
  function move(item: Item, eventId: string) {
    const destination = groups.find(({ event }) => event.id === eventId)?.event;
    if (!destination) return "이동할 입금을 찾을 수 없어요.";
    const issue = onMove(item, eventId);
    if (!issue) setNotice(`‘${item.label}’ 항목을 ‘${destination.label}’ 입금 아래로 옮겼어요.`);
    return issue;
  }
  const drag = useItemDrag((item, eventId) => {
    const issue = move(item, eventId);
    if (issue) setNotice(issue);
  });
  const openMove = groups.length > 1 ? setMoving : undefined;
  const dated = groups.filter(({ event }) => event.date !== null);
  const undated = groups.filter(({ event }) => event.date === null);
  return (
    <div className="timeline-groups">
      <div role="status" className={notice ? "meta" : "sr-only"}>{notice}</div>
      {openMove && groups.some(({ items }) => items.some(({ monthlyRuleId }) => !monthlyRuleId)) && (
        <p className="meta">‘이동’을 잡아 다른 입금 카드에 놓거나, 눌러서 이동할 입금을 고르세요.</p>
      )}
      {dated.map((group) => <EventGroup key={group.event.id} group={group} edits={edits} drag={drag} openMove={openMove} />)}
      {undated.length > 0 && <h3 className="timeline-divider">날짜 미정 입금</h3>}
      {undated.map((group) => <EventGroup key={group.event.id} group={group} edits={edits} drag={drag} openMove={openMove} />)}
      {moving && <ItemMoveDialog item={moving} events={groups.map(({ event }) => event)} onMove={move} onClose={() => setMoving(undefined)} />}
    </div>
  );
}
