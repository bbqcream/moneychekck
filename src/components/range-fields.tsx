import { toManwonInput } from "@/lib/calc/money";
import type { RangeAmount } from "@/types/scenario";

export function RangeFields({ amount, label = "금액" }: { amount?: RangeAmount; label?: string }) {
  return (
    <fieldset className="form-grid">
      <legend>{label} (만원)</legend>
      <label className="field">
        최소 또는 확정
        <input name="min" inputMode="decimal" placeholder="예: 7.5" defaultValue={amount ? toManwonInput(amount.min) : ""} required />
      </label>
      <label className="field">
        최대 <span className="optional">선택</span>
        <input name="max" inputMode="decimal" placeholder="범위일 때 입력" defaultValue={amount && amount.max !== amount.min ? toManwonInput(amount.max) : ""} />
      </label>
    </fieldset>
  );
}
