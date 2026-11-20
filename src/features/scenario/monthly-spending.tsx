import { useState } from "react";
import { BalanceText } from "@/components/balance-text";
import type { TimelineGroup } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import type { Item, ItemKind } from "@/types/scenario";
import { ItemMoveDialog } from "./item-move-dialog";
import { kindLabels, priorityLabels } from "./labels";
import { useItemDrag } from "./use-item-drag";

const kindTone: Record<string, string> = {
  expense: "spending-expense",
  saving: "spending-saving",
  investment: "spending-investment",
  debt: "spending-debt",
  transfer: "spending-transfer",
};

const kindEmoji: Record<ItemKind, string> = {
  expense: "🛒",
  saving: "🐷",
  investment: "📈",
  debt: "🧾",
  transfer: "💸",
};

export function MonthlySpending({ groups, onEdit, onMove }: {
  groups: TimelineGroup[];
  onEdit: () => void;
  onMove: (item: Item, eventId: string) => string | null;
}) {
  const [moving, setMoving] = useState<Item>();
  const [notice, setNotice] = useState("");
  const canMove = groups.length > 1 && groups.some(({ items }) => items.some(({ monthlyRuleId }) => !monthlyRuleId));
  const visibleGroups = canMove ? groups : groups.filter(({ items }) => items.length > 0);

  function move(item: Item, eventId: string) {
    const destination = groups.find(({ event }) => event.id === eventId)?.event;
    if (!destination) return "이동할 입금을 찾을 수 없어요.";
    const issue = onMove(item, eventId);
    if (!issue) setNotice(`‘${item.label}’ 항목을 ‘${destination.label}’ 아래로 옮겼어요.`);
    return issue;
  }

  const drag = useItemDrag((item, eventId) => {
    const issue = move(item, eventId);
    if (issue) setNotice(issue);
  });

  return (
    <section className="panel mt-4 p-4 sm:p-6" aria-labelledby="month-spending-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="month-spending-title">지출·저축 목록</h2>
        <button type="button" className="btn btn-secondary" onClick={onEdit}>수입·지출 편집</button>
      </div>
      <p role="status" className={notice ? "meta mb-3" : "sr-only"}>{notice}</p>
      {canMove && <p className="meta mb-3">‘이동’을 끌어 다른 입금에 놓거나 눌러서 입금을 고르세요.</p>}
      {visibleGroups.length ? (
        <div className="space-y-3">
          {visibleGroups.map(({ event, items }) => (
            <div key={event.id} data-drop-event={event.id} className={`spending-event${drag.targetId === event.id ? " ring-2 ring-brand" : ""}`}>
              <div className="spending-event-head">
                {event.date ? <time className="text-sm font-bold tabular-nums" dateTime={event.date}>{event.date}</time> : <span className="badge badge-pending">날짜 미정</span>}
                <h3 className="min-w-0 text-sm font-medium text-muted">{event.label}</h3>
              </div>
              {items.length ? <ul className="spending-list">
                {items.map(({ item, amount, balance, monthlyRuleId }) => (
                  <li key={item.id} className={`spending-item ${kindTone[item.kind]}${drag.draggedId === item.id ? " opacity-60" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="spending-kind-mark" aria-hidden="true">{kindEmoji[item.kind]}</span>
                        <h4 className="text-base leading-snug">{item.label}</h4>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={`badge spending-kind-badge ${kindTone[item.kind]}`}>{kindLabels[item.kind]}</span>
                        {item.priority && <span className="badge spending-priority-badge">{priorityLabels[item.priority]}</span>}
                      </div>
                      {monthlyRuleId && item.note && <p className="meta mt-1">{item.note}</p>}
                      {canMove && !monthlyRuleId && <button type="button" className="btn btn-quiet cursor-grab! touch-none select-none active:cursor-grabbing!"
                        aria-label={`${item.label} 다른 입금으로 이동`} {...drag.handle(item, setMoving)}>↔ 이동</button>}
                    </div>
                    <dl className="spending-metrics">
                      <div className="min-w-0">
                        <dt>계획 금액</dt>
                        <dd className="spending-plan-amount">
                          {formatRange(amount)}<span className="ml-1 inline-block text-xs font-semibold whitespace-nowrap text-muted">만원</span>
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt>항목 후 잔액</dt>
                        <dd><BalanceText balance={balance} /></dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul> : <p className="meta px-4 py-3">연결된 항목이 없어요.</p>}
            </div>
          ))}
        </div>
      ) : <p className="meta rounded-xl border border-dashed border-line bg-canvas px-4 py-6 text-center">이달에 등록한 지출이나 저축이 없어요.</p>}
      {moving && <ItemMoveDialog item={moving} events={groups.map(({ event }) => event)} onMove={move} onClose={() => setMoving(undefined)} />}
    </section>
  );
}
