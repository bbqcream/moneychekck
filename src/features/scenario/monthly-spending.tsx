import { BalanceText } from "@/components/balance-text";
import type { Timeline } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import { kindLabels, priorityLabels } from "./labels";

const kindTone: Record<string, string> = {
  expense: "spending-expense",
  saving: "spending-saving",
  investment: "spending-investment",
  debt: "spending-debt",
  transfer: "spending-transfer",
};

export function MonthlySpending({ timeline, month, onEdit }: { timeline?: Timeline; month: string; onEdit: () => void }) {
  const groups = timeline?.groups.filter(({ event, items }) => event.date?.startsWith(month) && items.length > 0) ?? [];

  return (
    <section className="panel mt-4 p-4 sm:p-6" aria-labelledby="month-spending-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="month-spending-title">지출·저축 목록</h2>
        <button type="button" className="btn btn-secondary" onClick={onEdit}>수입·지출 편집</button>
      </div>
      {groups.length ? (
        <div className="space-y-3">
          <div className="spending-grid hidden px-4 text-sm font-semibold text-muted sm:grid" aria-hidden="true">
            <span>항목</span>
            <span className="text-right">계획 금액</span>
            <span className="text-right">항목 후 잔액</span>
          </div>
          {groups.map(({ event, items }) => (
            <div key={event.id} className="spending-event">
              <div className="spending-event-head">
                <time className="text-sm font-bold tabular-nums" dateTime={event.date ?? undefined}>{event.date}</time>
                <h3 className="min-w-0 text-sm font-medium text-muted">{event.label}</h3>
              </div>
              <ul className="spending-list">
                {items.map(({ item, amount, balance }) => (
                  <li key={item.id} className={`spending-item spending-grid ${kindTone[item.kind]}`}>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="spending-kind-mark" aria-hidden="true">{kindLabels[item.kind].slice(0, 1)}</span>
                        <h4 className="text-base leading-snug">{item.label}</h4>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={`badge spending-kind-badge ${kindTone[item.kind]}`}>{kindLabels[item.kind]}</span>
                        {item.priority && <span className="badge spending-priority-badge">{priorityLabels[item.priority]}</span>}
                      </div>
                    </div>
                    <p className="spending-plan-amount">
                      <span className="sr-only">계획 금액 </span>{formatRange(amount)}<span className="ml-1 inline-block text-xs font-semibold whitespace-nowrap text-muted">만원</span>
                    </p>
                    <div className="spending-balance">
                      <span className="text-xs font-medium text-muted sm:sr-only">항목 후 잔액</span>
                      <BalanceText balance={balance} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : <p className="meta rounded-xl border border-dashed border-line bg-canvas px-4 py-6 text-center">이달에 등록한 지출이나 저축이 없어요.</p>}
    </section>
  );
}
