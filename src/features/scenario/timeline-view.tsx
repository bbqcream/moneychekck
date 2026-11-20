import { BalanceText } from "@/components/balance-text";
import type { TimelineGroup } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import type { Item, PayEvent } from "@/types/scenario";
import { kindLabels } from "./labels";

type TimelineActions = {
  addItem: (event: PayEvent) => void;
  editEvent: (event: PayEvent) => void;
  deleteEvent: (event: PayEvent) => void;
  editItem: (event: PayEvent, item: Item) => void;
  deleteItem: (item: Item) => void;
  moveItem: (item: Item, direction: -1 | 1) => void;
};

function EventGroup({ group, actions }: { group: TimelineGroup; actions: TimelineActions }) {
  const { event, balance, amount, items } = group;
  const taxChanged = amount.min !== event.amount.min || amount.max !== event.amount.max;
  const manual = items.filter(({ fixedExpenseId }) => !fixedExpenseId);
  return (
    <article className="event-card">
      <div className="event-head">
        <div className="event-icon" aria-hidden="true">+</div>
        <div className="entry-main">
          <div className="entry-title">
            <h3>{event.label}</h3>
            <span className={"badge " + (event.certainty === "confirmed" ? "badge-good" : "badge-pending")}>
              {event.certainty === "confirmed" ? "확실" : "미정"}
            </span>
          </div>
          <p className="meta">
            {event.date ?? "시기 미정"} · 입금 {formatRange(event.amount)}만원
            {taxChanged && " · 세후 " + formatRange(amount) + "만원"}
          </p>
          {event.note && <p className="item-note">{event.note}</p>}
        </div>
        <div className="entry-actions">
          <button type="button" className="btn btn-quiet" aria-label={event.label + " 입금 수정"} onClick={() => actions.editEvent(event)}>수정</button>
          <button type="button" className="btn btn-quiet" aria-label={event.label + " 입금 삭제"} onClick={() => actions.deleteEvent(event)}>삭제</button>
        </div>
        <div className="entry-balance event-balance">
          <span>입금 후 잔액</span>
          <BalanceText balance={balance} />
        </div>
      </div>
      {items.length > 0 && (
        <ol className="item-list">
          {items.map(({ item, amount, balance, fixedExpenseId }) => (
            <li className="item-row" key={item.id}>
              <div className="entry-main">
                <div className="entry-title">
                  <h4>{item.label}</h4>
                  <span className="badge badge-kind">{fixedExpenseId ? "월 고정지출" : kindLabels[item.kind]}</span>
                </div>
                <p className="meta">
                  {formatRange(amount)}만원
                  {item.repetition && (
                    " · " + formatRange(item.amount) + "만원 × " + item.repetition.count +
                    (item.repetition.unit === "daily" ? "일" : "개월")
                  )}
                </p>
                {item.note && <p className="item-note">{item.note}</p>}
              </div>
              {!fixedExpenseId && <div className="entry-actions">
                {manual.length > 1 && (
                  <>
                    <button type="button" className="btn btn-quiet order-button" aria-label={item.label + " 위로 이동"} disabled={item.id === manual[0].item.id} onClick={() => actions.moveItem(item, -1)}>↑</button>
                    <button type="button" className="btn btn-quiet order-button" aria-label={item.label + " 아래로 이동"} disabled={item.id === manual.at(-1)?.item.id} onClick={() => actions.moveItem(item, 1)}>↓</button>
                  </>
                )}
                <button type="button" className="btn btn-quiet" aria-label={item.label + " 항목 수정"} onClick={() => actions.editItem(event, item)}>수정</button>
                <button type="button" className="btn btn-quiet" aria-label={item.label + " 항목 삭제"} onClick={() => actions.deleteItem(item)}>삭제</button>
              </div>}
              <div className="entry-balance">
                <span>항목 후 잔액</span>
                <BalanceText balance={balance} />
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="event-footer">
        <button type="button" className="btn btn-secondary" aria-label={event.label + " 아래 항목 추가"} onClick={() => actions.addItem(event)}>+ 항목 추가</button>
      </div>
    </article>
  );
}

export function TimelineView({ groups, actions }: { groups: TimelineGroup[]; actions: TimelineActions }) {
  const dated = groups.filter(({ event }) => event.date !== null);
  const undated = groups.filter(({ event }) => event.date === null);
  return (
    <div className="timeline-groups">
      {dated.map((group) => <EventGroup key={group.event.id} group={group} actions={actions} />)}
      {undated.length > 0 && <h3 className="timeline-divider">시기 미정</h3>}
      {undated.map((group) => <EventGroup key={group.event.id} group={group} actions={actions} />)}
    </div>
  );
}
