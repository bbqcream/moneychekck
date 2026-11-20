import { useState, type FormEvent } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { formatManwon, parseManwon, parseScaled, toManwonInput } from "@/lib/calc/money";
import { isSalaryPeriod, maxSalaryMonths, monthlySalaryEvents } from "@/lib/calc/monthly";
import { usePlans } from "@/store/provider";
import type { MonthlySalary, Scenario } from "@/types/scenario";

function SalaryDialog({ salary, onSave, onClose }: {
  salary?: MonthlySalary;
  onSave: (salary: MonthlySalary) => string | null;
  onClose: () => void;
}) {
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    const amount = parseManwon(String(data.get("amount") ?? ""));
    const day = parseScaled(String(data.get("day") ?? ""), 0);
    const startMonth = String(data.get("startMonth") ?? "");
    const endMonth = String(data.get("endMonth") ?? "");
    if (!label) return setError("월급 이름을 입력해 주세요.");
    if (amount === null || amount <= 0) return setError("월급을 0보다 큰 금액으로 입력해 주세요.");
    if (day === null || day < 1 || day > 31) return setError("지급일을 1~31 사이의 날짜로 입력해 주세요.");
    if (!isSalaryPeriod(startMonth, endMonth)) {
      return setError(`시작월과 종료월을 순서대로 입력해 주세요. 최대 ${maxSalaryMonths}개월까지 설정할 수 있어요.`);
    }
    const issue = onSave({ label, amount, day, startMonth, endMonth });
    if (issue) setError(issue);
    else onClose();
  }

  return (
    <Dialog title={salary ? "고정 월급 수정" : "고정 월급 추가"} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">월급 이름
          <input name="label" defaultValue={salary?.label ?? "회사 월급"} maxLength={120} required />
        </label>
        <div className="form-grid">
          <label className="field">월급 (만원)
            <input name="amount" inputMode="decimal" defaultValue={salary ? toManwonInput(salary.amount) : ""} required />
          </label>
          <label className="field">매월 지급일 (1~31일)
            <input name="day" inputMode="numeric" defaultValue={salary?.day} required />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">시작월
            <input name="startMonth" type="month" placeholder="YYYY-MM" defaultValue={salary?.startMonth} required />
          </label>
          <label className="field">종료월
            <input name="endMonth" type="month" placeholder="YYYY-MM" defaultValue={salary?.endMonth} required />
          </label>
        </div>
        <p className="meta">지정한 날짜가 없는 달에는 말일에 반영해요. 이미 월급을 입력한 달이 있다면 시작월을 확인해 주세요.</p>
        <FormActions error={error} onCancel={onClose} />
      </form>
    </Dialog>
  );
}

export function MonthlySalaryCard({ scenario, collapsible = false }: { scenario?: Scenario; collapsible?: boolean }) {
  const updatePlan = usePlans((state) => state.updatePlan);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const salary = scenario?.monthlySalary;
  const close = () => setDialog(null);

  const content = scenario ? (
    <>
      {salary ? (
        <div className="mb-3 rounded-xl bg-canvas p-3">
          <h3>{salary.label}</h3>
          <p className="meta">월 {formatManwon(salary.amount)}만원 · 매월 {salary.day}일</p>
          <p className="meta">{salary.startMonth} ~ {salary.endMonth}</p>
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
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">고정 월급{salary && ` · ${formatManwon(salary.amount)}만원`}</summary>
          {content}
        </details>
      ) : (
        <section className="panel p-4 sm:p-5" aria-label="고정 월급">
          <h2 className="mb-3">고정 월급</h2>
          {content}
        </section>
      )}
      {scenario && dialog === "edit" && (
        <SalaryDialog salary={salary} onClose={close} onSave={(monthlySalary) => updatePlan(scenario.id, (plan) => ({ ...plan, monthlySalary }))} />
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
