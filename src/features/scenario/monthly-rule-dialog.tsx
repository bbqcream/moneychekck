import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { RangeFields } from "@/components/range-fields";
import { isMonth } from "@/lib/calc/monthly";
import { parseRange, parseScaled } from "@/lib/calc/money";
import { createId } from "@/lib/create-id";
import { isSpendingPriority, type MonthlyRate, type MonthlyRule, type MonthlyRuleKind, type MonthlySaving, type SavingsAllocation } from "@/types/scenario";
import { monthlyRuleLabels } from "./labels";
import { PriorityField } from "./priority-field";

export function MonthlyRuleDialog({ kind, rule, onSave, onClose }: {
  kind: MonthlyRuleKind;
  rule?: MonthlyRule | MonthlySaving;
  onSave: (rule: MonthlyRule, allocation?: SavingsAllocation) => string | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<{ key: number; rate?: MonthlyRate }[]>(() =>
    rule ? rule.rates.map((rate, key) => ({ key, rate })) : [{ key: 0 }],
  );
  const initialAllocation = rule && "allocation" in rule ? rule.allocation : undefined;
  const [ratioInput, setRatioInput] = useState(String(initialAllocation?.savingsPercent ?? 100));
  const savingsPercent = parseScaled(ratioInput, 0);
  const saving = kind === "saving";
  const title = monthlyRuleLabels[kind];
  const nextKey = useRef(rows.length);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    const priority = data.get("priority");
    const starts = data.getAll("startMonth");
    const mins = data.getAll("min");
    const maxes = data.getAll("max");
    const rates: MonthlyRate[] = [];
    if (!label) return setError(title + " 이름을 입력해 주세요.");
    let allocation: SavingsAllocation | undefined;
    if (saving) {
      if (savingsPercent === null || savingsPercent > 100) return setError("저축 비율을 0~100 사이의 정수로 입력해 주세요.");
      const savingsLabel = String(data.get("savingsLabel") ?? "").trim();
      const investmentLabel = String(data.get("investmentLabel") ?? "").trim();
      if (!savingsLabel || !investmentLabel) return setError("저축과 투자 목적을 입력해 주세요.");
      allocation = { savingsPercent, savingsLabel, investmentLabel };
    }
    for (const [index, start] of starts.entries()) {
      const startMonth = String(start).trim();
      const amount = parseRange(String(mins[index] ?? ""), String(maxes[index] ?? ""));
      if (!isMonth(startMonth) || !amount) return setError("올바른 적용 시작월과 월 금액을 입력해 주세요.");
      rates.push({ startMonth, amount });
    }
    if (new Set(rates.map(({ startMonth }) => startMonth)).size !== rates.length) {
      return setError("각 변경의 적용 시작월을 다르게 입력해 주세요.");
    }
    rates.sort((a, b) => a.startMonth.localeCompare(b.startMonth));
    const issue = onSave({
      id: rule?.id ?? createId(), label, rates,
      priority: isSpendingPriority(priority) ? priority : undefined,
    }, allocation);
    if (issue) setError(issue);
    else onClose();
  }

  return (
    <Dialog title={title + (rule ? " 수정" : " 추가")} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">{saving ? "고정저축 이름" : "고정지출 이름"}
          <input name="label" defaultValue={rule?.label} placeholder={saving ? "예: 매달 모으기" : "예: 교통비"} maxLength={120} required />
        </label>
        <PriorityField value={rule?.priority} />
        {saving && (
          <>
            <div className="form-grid">
              <label className="field">저축 비율 (%)
                <input name="savingsPercent" inputMode="numeric" value={ratioInput} onChange={(event) => setRatioInput(event.target.value)} required />
              </label>
              <p className="meta self-center">
                투자 비율 {savingsPercent !== null && savingsPercent <= 100 ? 100 - savingsPercent + "%" : "—"}
              </p>
            </div>
            <div className="form-grid">
              <label className="field">저축 목적
                <input name="savingsLabel" defaultValue={initialAllocation?.savingsLabel ?? "비상금"} maxLength={120} required />
              </label>
              <label className="field">투자 목적
                <input name="investmentLabel" defaultValue={initialAllocation?.investmentLabel ?? "장기 투자"} maxLength={120} required />
              </label>
            </div>
          </>
        )}
        {rows.map(({ key, rate }) => (
          <div className="form-stack rounded-xl border border-line p-3" key={key}>
            <label className="field">적용 시작월<input type="month" name="startMonth" placeholder="YYYY-MM" defaultValue={rate?.startMonth} required /></label>
            <RangeFields amount={rate?.amount} label={saving ? "매달 모을 총액" : "월 금액"} />
            {rows.length > 1 && <button type="button" className="btn btn-quiet self-start" onClick={() => setRows(rows.filter((row) => row.key !== key))}>이 적용월 삭제</button>}
          </div>
        ))}
        <button type="button" className="btn btn-secondary self-start" onClick={() => {
          const key = nextKey.current++;
          setRows([...rows, { key }]);
        }}>금액 변경 추가</button>
        <FormActions error={error} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
