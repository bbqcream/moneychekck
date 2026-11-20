import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { formatRange } from "@/lib/calc/money";
import { usePlans } from "@/store/provider";
import type { MonthlyExpense, Scenario } from "@/types/scenario";
import { priorityLabels } from "./labels";
import { MonthlyExpenseDialog } from "./monthly-expense-dialog";

type ExpenseDialog = { type: "edit"; expense?: MonthlyExpense } | { type: "delete"; expense: MonthlyExpense };

export function MonthlyExpenses({ scenario, collapsible = false }: {
  scenario: Scenario;
  collapsible?: boolean;
}) {
  const updatePlan = usePlans((state) => state.updatePlan);
  const [dialog, setDialog] = useState<ExpenseDialog | null>(null);
  const expenses = scenario.monthlyExpenses ?? [];
  const close = () => setDialog(null);
  const update = (transform: (list: MonthlyExpense[]) => MonthlyExpense[]) =>
    updatePlan(scenario.id, (plan) => ({ ...plan, monthlyExpenses: transform(plan.monthlyExpenses ?? []) }));

  const content = (
    <>
      <p className="meta mb-3">{expenses.length
        ? "날짜가 있는 입금이 있는 달마다 한 번 적용돼요. 확실한 입금이 있으면 그달의 첫 확실한 입금에서 차감해요."
        : "등록된 월 고정지출이 없어요."}</p>
      {expenses.length > 0 && (
        <ul className="mb-3 space-y-2">
          {expenses.map((expense) => (
            <li className="rounded-xl bg-canvas p-3" key={expense.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h3>{expense.label}</h3>
                {expense.priority && <span className="badge badge-kind">{priorityLabels[expense.priority]}</span>}
              </div>
              {[...expense.rates].sort((a, b) => a.startMonth.localeCompare(b.startMonth)).map(({ startMonth, amount }) => (
                <p key={startMonth} className="meta">{startMonth}부터 월 {formatRange(amount)}만원</p>
              ))}
              <div className="button-row">
                <button type="button" className="btn btn-quiet" aria-label={expense.label + " 고정지출 수정"} onClick={() => setDialog({ type: "edit", expense })}>수정</button>
                <button type="button" className="btn btn-quiet danger-text" aria-label={expense.label + " 고정지출 삭제"} onClick={() => setDialog({ type: "delete", expense })}>삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "edit" })}>월 고정지출 추가</button>
    </>
  );

  return (
    <>
      {collapsible ? (
        <details className="panel px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">월 고정지출{expenses.length > 0 && " " + expenses.length + "개"}</summary>
          {content}
        </details>
      ) : content}
      {dialog?.type === "edit" && (
        <MonthlyExpenseDialog expense={dialog.expense} onClose={close} onSave={(expense) => update((list) =>
          list.some(({ id }) => id === expense.id)
            ? list.map((current) => current.id === expense.id ? expense : current)
            : [...list, expense],
        )} />
      )}
      {dialog?.type === "delete" && (
        <ConfirmAction title="월 고정지출을 삭제할까요?" description={"‘" + dialog.expense.label + "’를 빼고 잔액을 다시 계산해요."}
          actionLabel="고정지출 삭제" onClose={close}
          onConfirm={() => update((list) => list.filter(({ id }) => id !== dialog.expense.id)) ?? undefined} />
      )}
    </>
  );
}
