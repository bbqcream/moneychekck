import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { formatRange } from "@/lib/calc/money";
import { splitSavingsAmount } from "@/lib/calc/monthly";
import { usePlans } from "@/store/provider";
import type { MonthlyRule, MonthlyRuleKind, MonthlySaving, RangeAmount, SavingsAllocation, Scenario } from "@/types/scenario";
import { monthlyRuleLabels, priorityLabels } from "./labels";
import { MonthlyRuleDialog } from "./monthly-rule-dialog";

type RuleDialog = { type: "edit"; rule?: MonthlyRule | MonthlySaving } | { type: "delete"; rule: MonthlyRule | MonthlySaving };

function saveToList<T extends { id: string }>(list: T[] = [], rule: T): T[] {
  return list.some(({ id }) => id === rule.id)
    ? list.map((current) => current.id === rule.id ? rule : current)
    : [...list, rule];
}

export function MonthlyRules({ scenario, kind, collapsible = false }: {
  scenario?: Scenario;
  kind: MonthlyRuleKind;
  collapsible?: boolean;
}) {
  const updatePlan = usePlans((state) => state.updatePlan);
  const [dialog, setDialog] = useState<RuleDialog | null>(null);
  const saving = kind === "saving";
  const title = monthlyRuleLabels[kind];
  const rules: (MonthlyRule | MonthlySaving)[] = (saving ? scenario?.monthlySavings : scenario?.monthlyExpenses) ?? [];
  const close = () => setDialog(null);
  if (!scenario) {
    return (
      <section className="panel p-4 sm:p-5" aria-label={title}>
        <h2 className="mb-3">{title}</h2>
        <p className="meta">시나리오를 만들면 추가할 수 있어요.</p>
      </section>
    );
  }
  const { id } = scenario;

  function save(rule: MonthlyRule | MonthlySaving) {
    return updatePlan(id, (plan) => "allocation" in rule
      ? { ...plan, monthlySavings: saveToList(plan.monthlySavings, rule) }
      : { ...plan, monthlyExpenses: saveToList(plan.monthlyExpenses, rule) });
  }

  function remove(ruleId: string) {
    const keep = ({ id }: { id: string }) => id !== ruleId;
    return updatePlan(id, (plan) => saving
      ? { ...plan, monthlySavings: plan.monthlySavings?.filter(keep) }
      : { ...plan, monthlyExpenses: plan.monthlyExpenses?.filter(keep) }) ?? undefined;
  }

  const content = (
    <>
      <p className="meta mb-3">{rules.length
        ? "날짜가 있는 입금이 있는 달마다 한 번 적용돼요. 확실한 입금이 있으면 그달의 첫 확실한 입금에서 차감해요."
        : "등록된 " + title + "이 없어요."}</p>
      {rules.length > 0 && (
        <ul className="mb-3 space-y-2">
          {rules.map((rule) => {
            const allocation = "allocation" in rule ? rule.allocation : undefined;
            return (
              <li className="rounded-xl bg-canvas p-3" key={rule.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3>{rule.label}</h3>
                  {rule.priority && <span className="badge badge-kind">{priorityLabels[rule.priority]}</span>}
                </div>
                {[...rule.rates].sort((a, b) => a.startMonth.localeCompare(b.startMonth)).map((rate) => (
                  <div key={rate.startMonth} className="my-1">
                    {"salaryPercent" in rate ? <p className="meta">{rate.startMonth}부터 세후 고정 월급의 {rate.salaryPercent}%</p> :
                      <p className="meta">{rate.startMonth}부터 월 {formatRange(rate.amount)}만원</p>}
                    {allocation && ("amount" in rate ? <AllocationAmounts amount={rate.amount} allocation={allocation} /> :
                      <p className="meta">저축 {allocation.savingsPercent}% · 투자 {100 - allocation.savingsPercent}%</p>)}
                  </div>
                ))}
                <div className="button-row">
                  <button type="button" className="btn btn-quiet" aria-label={rule.label + (saving ? " 고정저축 수정" : " 고정지출 수정")} onClick={() => setDialog({ type: "edit", rule })}>수정</button>
                  <button type="button" className="btn btn-quiet danger-text" aria-label={rule.label + (saving ? " 고정저축 삭제" : " 고정지출 삭제")} onClick={() => setDialog({ type: "delete", rule })}>삭제</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "edit" })}>{title} 추가</button>
    </>
  );

  return (
    <>
      {collapsible ? (
        <details className="panel px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{title}{rules.length > 0 && " " + rules.length + "개"}</summary>
          {content}
        </details>
      ) : (
        <section className="panel p-4 sm:p-5" aria-label={title}>
          <h2 className="mb-3">{title}</h2>
          {content}
        </section>
      )}
      {dialog?.type === "edit" && (
        <MonthlyRuleDialog kind={kind} rule={dialog.rule} onClose={close} onSave={save} />
      )}
      {dialog?.type === "delete" && (
        <ConfirmAction title={title + "을 삭제할까요?"} description={"‘" + dialog.rule.label + "’를 빼고 잔액을 다시 계산해요."}
          actionLabel={title + " 삭제"} onClose={close}
          onConfirm={() => remove(dialog.rule.id)} />
      )}
    </>
  );
}

function AllocationAmounts({ amount, allocation }: {
  amount: RangeAmount;
  allocation: SavingsAllocation;
}) {
  const { savingsPercent, savingsLabel, investmentLabel } = allocation;
  const { savings, investment } = splitSavingsAmount(amount, savingsPercent);
  return (
    <div className="meta">
      <p>저축 {savingsPercent}% · {savingsLabel} {formatRange(savings)}만원</p>
      <p>투자 {100 - savingsPercent}% · {investmentLabel} {formatRange(investment)}만원</p>
    </div>
  );
}
