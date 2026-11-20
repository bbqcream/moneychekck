import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { formatManwon } from "@/lib/calc/money";
import { monthlySalaryEvents } from "@/lib/calc/monthly";
import { usePlans } from "@/store/provider";
import type { Scenario } from "@/types/scenario";
import { MonthlySalaryDialog } from "./monthly-salary-dialog";

export function MonthlySalaryCard({ scenario, collapsible = false }: { scenario?: Scenario; collapsible?: boolean }) {
  const updatePlan = usePlans((state) => state.updatePlan);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const salary = scenario?.monthlySalary;
  const hourly = salary?.hourly;
  const calendarBased = hourly?.schedule === "current-month" || hourly?.schedule === "previous-month";
  const amountDescription = salary && (calendarBased ? "시급으로 계산" : `월 ${formatManwon(salary.amount)}만원`);
  const close = () => setDialog(null);

  const content = scenario ? (
    <>
      {salary ? (
        <div className="mb-3 rounded-xl bg-canvas p-3">
          <h3>{salary.label}</h3>
          <p className="meta">{amountDescription} · 매월 {salary.day}일</p>
          {hourly && <p className="meta">
            시급 {hourly.hourlyWon.toLocaleString("ko-KR")}원 · 하루 {hourly.hourHundredths / 100}시간 · {hourly.schedule === "manual"
              ? `월 ${hourly.days}일` : hourly.schedule === "previous-month" ? "전월 평일" : "지급월 평일"}
          </p>}
          <p className="meta">지급 기간 {salary.startMonth} ~ {salary.endMonth}</p>
        </div>
      ) : <p className="meta mb-3">매달 들어올 월급을 시나리오 잔액에 반영해요.</p>}
      <div className="button-row">
        <button type="button" className="btn btn-secondary" onClick={() => setDialog("edit")}>{salary ? "고정 월급 수정" : "고정 월급 추가"}</button>
        {salary && <button type="button" className="btn btn-quiet danger-text" onClick={() => setDialog("delete")}>고정 월급 삭제</button>}
      </div>
    </>
  ) : <p className="meta">시나리오를 만들면 추가할 수 있어요.</p>;

  return (
    <>
      {collapsible ? (
        <details className="panel px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">고정 월급{amountDescription && ` · ${amountDescription}`}</summary>
          {content}
        </details>
      ) : (
        <section className="panel p-4 sm:p-5" aria-label="고정 월급">
          <h2 className="mb-3">고정 월급</h2>
          {content}
        </section>
      )}
      {scenario && dialog === "edit" && (
        <MonthlySalaryDialog salary={salary} onClose={close} onSave={(monthlySalary) => updatePlan(scenario.id, (plan) => ({ ...plan, monthlySalary }))} />
      )}
      {scenario && dialog === "delete" && (
        <ConfirmAction title="고정 월급을 삭제할까요?" description="고정 월급으로 생성된 입금과 연결된 항목도 함께 삭제돼요."
          actionLabel="고정 월급 삭제" onClose={close} onConfirm={() => updatePlan(scenario.id, (plan) => {
            const salaryIds = new Set(monthlySalaryEvents(plan.monthlySalary).map(({ id }) => id));
            return { ...plan, monthlySalary: undefined, items: plan.items.filter(({ afterEventId }) => !salaryIds.has(afterEventId)) };
          }) ?? undefined} />
      )}
    </>
  );
}
