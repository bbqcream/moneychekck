import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { RangeFields } from "@/components/range-fields";
import { isCommuteFare, isMonth } from "@/lib/calc/monthly";
import { parseRange, parseScaled } from "@/lib/calc/money";
import { createId } from "@/lib/create-id";
import { isSpendingPriority, type CommuteFare, type MonthlyExpenseRate, type MonthlyRule, type MonthlyRuleKind, type MonthlySaving, type MonthlySavingRate, type SavingsAllocation } from "@/types/scenario";
import { monthlyRuleLabels } from "./labels";
import { PriorityField } from "./priority-field";

type Rate = MonthlyExpenseRate | MonthlySavingRate;
type RateBasis = "fixed" | "salary" | "commute";

export function MonthlyRuleDialog({ kind, rule, month, onSave, onClose }: {
  kind: MonthlyRuleKind;
  rule?: MonthlyRule | MonthlySaving;
  month?: string;
  onSave: (rule: MonthlyRule | MonthlySaving) => string | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<{ key: number; rate?: Rate; basis: RateBasis }[]>(() =>
    rule ? rule.rates.map((rate, key) => ({ key, rate, basis: "salaryPercent" in rate ? "salary" : "commute" in rate ? "commute" : "fixed" })) : [{ key: 0, basis: "fixed" }],
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
    const rates: Rate[] = [];
    if (!label) return setError(title + " 이름을 입력해 주세요.");
    let allocation: SavingsAllocation | undefined;
    if (saving) {
      if (savingsPercent === null || savingsPercent > 100) return setError("저축 비율을 0~100 사이의 정수로 입력해 주세요.");
      const savingsLabel = String(data.get("savingsLabel") ?? "").trim();
      const investmentLabel = String(data.get("investmentLabel") ?? "").trim();
      if (!savingsLabel || !investmentLabel) return setError("저축과 투자 목적을 입력해 주세요.");
      allocation = { savingsPercent, savingsLabel, investmentLabel };
    }
    let fixedIndex = 0;
    for (const [index, start] of starts.entries()) {
      const startMonth = String(start).trim();
      if (!isMonth(startMonth)) return setError("올바른 적용 시작월을 입력해 주세요.");
      const { key, basis } = rows[index];
      if (basis === "salary") {
        const salaryPercent = parseScaled(String(data.get("salaryPercent-" + key) ?? ""), 0);
        if (salaryPercent === null || salaryPercent > 100) return setError("월급에서 모을 비율을 0~100 사이의 정수로 입력해 주세요.");
        rates.push({ startMonth, salaryPercent });
      } else if (basis === "commute") {
        const oneWayWon = parseScaled(String(data.get("oneWayWon-" + key) ?? ""), 0);
        const extraWon = parseScaled(String(data.get("extraWon-" + key) ?? ""), 0);
        const daysInput = String(data.get("commuteDays-" + key) ?? "").trim();
        const days = daysInput ? parseScaled(daysInput, 0) : undefined;
        if (oneWayWon === null || extraWon === null || days === null || !isCommuteFare({ oneWayWon, extraWon, days })) {
          return setError("교통비는 0원 이상의 금액, 출근일수는 0~31일로 입력해 주세요.");
        }
        rates.push({ startMonth, commute: { oneWayWon, extraWon, days } });
      } else {
        const amount = parseRange(String(mins[fixedIndex] ?? ""), String(maxes[fixedIndex] ?? ""));
        if (!amount) return setError("올바른 월 금액을 입력해 주세요.");
        rates.push({ startMonth, amount });
        fixedIndex++;
      }
    }
    if (new Set(rates.map(({ startMonth }) => startMonth)).size !== rates.length) {
      return setError("각 변경의 적용 시작월을 다르게 입력해 주세요.");
    }
    rates.sort((a, b) => a.startMonth.localeCompare(b.startMonth));
    const fields = {
      id: rule?.id ?? createId(), label,
      priority: isSpendingPriority(priority) ? priority : undefined,
    };
    const issue = onSave(allocation
      ? { ...fields, rates: rates.filter((rate): rate is MonthlySavingRate => "amount" in rate || "salaryPercent" in rate), allocation }
      : { ...fields, rates: rates.filter((rate): rate is MonthlyExpenseRate => "amount" in rate || "commute" in rate) });
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
        {rows.map(({ key, rate, basis }, index) => (
          <div className="form-stack rounded-xl border border-line p-3" key={key}>
            <label className="field">적용 시작월<input type="month" name="startMonth" placeholder="YYYY-MM" defaultValue={rate?.startMonth ?? (index === 0 ? month : undefined)} required /></label>
            <label className="field">월 금액 계산 방식
              <select name={"rateBasis-" + key} value={basis} onChange={(event) => {
                const basis = event.target.value;
                if (basis === "fixed" || basis === "salary" || basis === "commute") {
                  setRows(rows.map((row) => row.key === key ? { ...row, basis } : row));
                }
              }}>
                <option value="fixed">금액 직접 입력</option>
                {saving ? <option value="salary">월급의 일정 비율</option> : <option value="commute">교통비 자동 계산</option>}
              </select>
            </label>
            {basis === "salary" ? <label className="field">월급에서 모을 비율 (%)
              <input name={"salaryPercent-" + key} inputMode="numeric" placeholder="예: 20" defaultValue={rate && "salaryPercent" in rate ? rate.salaryPercent : undefined} required />
              <span className="meta">그달 세후 고정 월급을 기준으로 계산해요.</span>
            </label> : basis === "commute" ? <CommuteFields rowKey={key} fare={rate && "commute" in rate ? rate.commute : undefined} /> :
              <RangeFields amount={rate && "amount" in rate ? rate.amount : undefined} label={saving ? "매달 모을 총액" : "월 금액"} />}
            {rows.length > 1 && <button type="button" className="btn btn-quiet self-start" onClick={() => setRows(rows.filter((row) => row.key !== key))}>이 적용월 삭제</button>}
          </div>
        ))}
        <button type="button" className="btn btn-secondary self-start" onClick={() => {
          const key = nextKey.current++;
          setRows([...rows, { key, basis: "fixed" }]);
        }}>금액 변경 추가</button>
        <FormActions error={error} onCancel={onClose} />
      </form>
    </Dialog>
  );
}

function CommuteFields({ rowKey, fare }: { rowKey: number; fare?: CommuteFare }) {
  return (
    <>
      <div className="form-grid">
        <label className="field">편도 요금 (원)
          <input name={"oneWayWon-" + rowKey} inputMode="numeric" defaultValue={fare?.oneWayWon ?? 1500} required />
        </label>
        <label className="field">월 추가 교통비 (원)
          <input name={"extraWon-" + rowKey} inputMode="numeric" defaultValue={fare?.extraWon ?? 15000} required />
        </label>
      </div>
      <label className="field">출근일수 직접 지정 <span className="optional">선택</span>
        <input name={"commuteDays-" + rowKey} inputMode="numeric" defaultValue={fare?.days} placeholder="비우면 달력으로 계산" />
        <span className="meta">비워 두면 해당 달의 평일에서 한국 공휴일을 빼고, 출근일마다 왕복 요금을 계산해요.</span>
      </label>
    </>
  );
}
