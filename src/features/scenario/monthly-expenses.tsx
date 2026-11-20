import { formatRange } from "@/lib/calc/money";
import type { MonthlyExpense } from "@/types/scenario";

export function MonthlyExpenses({ expenses, onEdit, onDelete }: {
  expenses: MonthlyExpense[];
  onEdit: (expense?: MonthlyExpense) => void;
  onDelete: (expense: MonthlyExpense) => void;
}) {
  return (
    <details className="panel px-3 py-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">월 고정지출{expenses.length > 0 && " " + expenses.length + "개"}</summary>
      <p className="meta mb-3">날짜가 있는 입금이 있는 달마다 한 번 적용돼요. 확실한 입금이 있으면 그달의 첫 확실한 입금에서 차감해요.</p>
      {expenses.length > 0 && (
        <ul className="mb-3 space-y-2">
          {expenses.map((expense) => (
            <li className="rounded-xl bg-canvas p-3" key={expense.id}>
              <h3>{expense.label}</h3>
              {[...expense.rates].sort((a, b) => a.startMonth.localeCompare(b.startMonth)).map(({ startMonth, amount }) => (
                <p key={startMonth} className="meta">{startMonth}부터 월 {formatRange(amount)}만원</p>
              ))}
              <div className="button-row">
                <button type="button" className="btn btn-quiet" aria-label={expense.label + " 고정지출 수정"} onClick={() => onEdit(expense)}>수정</button>
                <button type="button" className="btn btn-quiet danger-text" aria-label={expense.label + " 고정지출 삭제"} onClick={() => onDelete(expense)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-secondary mb-2" onClick={() => onEdit()}>월 고정지출 추가</button>
    </details>
  );
}
