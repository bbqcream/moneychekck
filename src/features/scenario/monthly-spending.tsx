import { BalanceText } from "@/components/balance-text";
import type { Timeline } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import { kindLabels, priorityLabels } from "./labels";

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
            <div key={event.id} className="overflow-hidden rounded-xl border border-line">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line bg-canvas px-3 py-2.5 sm:px-4">
                <time className="text-sm font-bold tabular-nums" dateTime={event.date ?? undefined}>{event.date}</time>
                <h3 className="min-w-0 text-sm font-medium text-muted">{event.label}</h3>
              </div>
              <ul className="divide-y divide-line">
                {items.map(({ item, amount, balance }) => (
                  <li key={item.id} className="spending-grid grid items-start px-3 py-3 sm:items-center sm:px-4">
                    <div className="min-w-0">
                      <h4 className="text-base leading-snug">{item.label}</h4>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={`badge ${item.kind === "saving" || item.kind === "investment" ? "badge-good" : "badge-kind"}`}>{kindLabels[item.kind]}</span>
                        {item.priority && <span className="badge bg-canvas text-muted">{priorityLabels[item.priority]}</span>}
                      </div>
                    </div>
                    <p className="self-start text-right text-base font-bold leading-tight tabular-nums wrap-anywhere sm:self-center sm:text-lg">
                      <span className="sr-only">계획 금액 </span>{formatRange(amount)}<span className="ml-1 inline-block text-xs font-semibold whitespace-nowrap text-muted">만원</span>
                    </p>
                    <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-canvas px-2.5 py-1.5 text-sm sm:col-span-1 sm:justify-end sm:bg-transparent sm:p-0 sm:text-right">
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
