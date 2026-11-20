import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { RangeFields } from "@/components/range-fields";
import { isMonth } from "@/lib/calc/monthly";
import { parseRange } from "@/lib/calc/money";
import { createId } from "@/lib/create-id";
import type { MonthlyExpense, MonthlyRate } from "@/types/scenario";

export function MonthlyExpenseDialog({ expense, onSave, onClose }: {
  expense?: MonthlyExpense;
  onSave: (expense: MonthlyExpense) => string | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<{ key: number; rate?: MonthlyRate }[]>(() =>
    expense ? expense.rates.map((rate, key) => ({ key, rate })) : [{ key: 0 }],
  );
  const nextKey = useRef(rows.length);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    const starts = data.getAll("startMonth");
    const mins = data.getAll("min");
    const maxes = data.getAll("max");
    const rates: MonthlyRate[] = [];
    if (!label) return setError("고정지출 이름을 입력해 주세요.");
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
    const issue = onSave({ id: expense?.id ?? createId(), label, rates });
    if (issue) setError(issue);
    else onClose();
  }

  return (
    <Dialog title={expense ? "월 고정지출 수정" : "월 고정지출 추가"} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">고정지출 이름<input name="label" defaultValue={expense?.label} placeholder="예: 교통비" maxLength={120} required /></label>
        {rows.map(({ key, rate }) => (
          <div className="form-stack rounded-xl border border-line p-3" key={key}>
            <label className="field">적용 시작월<input type="month" name="startMonth" placeholder="YYYY-MM" defaultValue={rate?.startMonth} required /></label>
            <RangeFields amount={rate?.amount} label="월 금액" />
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
