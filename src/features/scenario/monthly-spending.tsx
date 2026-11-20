import { BalanceText } from "@/components/balance-text";
import type { Timeline } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import { kindLabels, priorityLabels } from "./labels";

export function MonthlySpending({ timeline, month, onEdit }: { timeline?: Timeline; month: string; onEdit: () => void }) {
  const rows = timeline?.groups.filter(({ event }) => event.date?.startsWith(month))
    .flatMap(({ event, items }) => items.map((entry) => ({ ...entry, date: event.date }))) ?? [];

  return (
    <section className="panel mt-4 p-4 sm:p-6" aria-labelledby="month-spending-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="month-spending-title">지출·저축 목록</h2>
        <button type="button" className="btn btn-secondary" onClick={onEdit}>수입·지출 편집</button>
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map(({ item, amount, balance, date }) => (
            <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3">
              <div className="min-w-0">
                <h3 className="wrap-anywhere">{item.label}</h3>
                <p className="meta">{date} · {kindLabels[item.kind]}{item.priority && ` · ${priorityLabels[item.priority]}`}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatRange(amount)}만원</p>
                <p className="meta">항목 후 잔액 <BalanceText balance={balance} /></p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="meta">이달에 등록한 지출이나 저축이 없어요.</p>}
    </section>
  );
}
