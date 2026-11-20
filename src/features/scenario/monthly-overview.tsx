import { BalanceText } from "@/components/balance-text";
import type { Timeline } from "@/lib/calc/balance";
import { formatRange } from "@/lib/calc/money";
import { isMonth } from "@/lib/calc/monthly";
import { stepMonth, summarizeMonth } from "@/lib/calc/monthly-overview";
import type { PayEvent } from "@/types/scenario";

export function MonthlyOverview({ timeline, month, setMonth, pending }: {
  timeline?: Timeline;
  month: string;
  setMonth: (month: string) => void;
  pending: PayEvent[];
}) {
  const previous = stepMonth(month, -1);
  const next = stepMonth(month, 1);
  const totals = timeline && summarizeMonth(timeline, month);

  return (
    <section className="panel p-4 sm:p-6" aria-labelledby="monthly-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="monthly-title">월별 계획</h2>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button type="button" className="btn btn-secondary" aria-label="이전 달" onClick={() => setMonth(previous)} disabled={previous === month}>←</button>
          <label className="field min-w-0">
            <span className="sr-only">보고 있는 달</span>
            <input type="month" value={month} onChange={(event) => {
              if (isMonth(event.target.value)) setMonth(event.target.value);
            }} />
          </label>
          <button type="button" className="btn btn-secondary" aria-label="다음 달" onClick={() => setMonth(next)} disabled={next === month}>→</button>
        </div>
      </div>
      {pending.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="mb-2 text-sm">날짜 미정 입금</h3>
          <ul className="space-y-2">
            {pending.map((event) => <li className="flex flex-wrap justify-between gap-2 text-sm" key={event.id}>
              <span className="wrap-anywhere">{event.label}</span><span className="font-semibold">{formatRange(event.amount)}만원</span>
            </li>)}
          </ul>
          <p className="meta mt-2">입금일을 정하면 해당 월의 잔액에 반영돼요.</p>
        </div>
      )}
      <div aria-live="polite">
        {totals ? (
          <>
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-xl bg-canvas p-3">
                <dt className="meta">입금</dt>
                <dd className="font-bold wrap-anywhere">{formatRange(totals.income)}만원</dd>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <dt className="meta">지출·상환·송금</dt>
                <dd className="font-bold wrap-anywhere">{formatRange(totals.spending)}만원</dd>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <dt className="meta">저축·투자</dt>
                <dd className="font-bold wrap-anywhere">{formatRange(totals.savings)}만원</dd>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <dt className="meta">월말 예상 잔액</dt>
                <dd>{totals.closing ? <BalanceText balance={totals.closing} /> : <span className="muted">—</span>}</dd>
              </div>
            </dl>
            <p className="meta mt-3">{totals.count ? "앞 달 잔액을 이월해요. 날짜가 정해진 입금 기준이에요." : "이달에 날짜가 정해진 입금이 없어요."}</p>
          </>
        ) : <p className="meta">월별 수입·지출을 추가하면 이달의 잔액을 볼 수 있어요.</p>}
      </div>
    </section>
  );
}
