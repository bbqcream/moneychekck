import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { parseTaxRate } from "@/lib/calc/tax";
import type { Scenario, TaxMode } from "@/types/scenario";

export function taxLabel(scenario: Scenario) {
  if (scenario.taxMode === "none") return "적용 안 함";
  if (scenario.taxMode === "withholding-3.3") return "3.3% 원천징수";
  return "직접 입력 " + ((scenario.customTaxBasisPoints ?? 0) / 100) + "%";
}

export function TaxDialog({ scenario, onSave, onClose }: {
  scenario: Scenario;
  onSave: (taxMode: TaxMode, rate?: number) => string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState(scenario.taxMode);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rate = mode === "custom"
      ? parseTaxRate(String(new FormData(event.currentTarget).get("rate") ?? ""))
      : undefined;
    if (rate === null) return setError("0~100% 사이의 세율을 소수 둘째 자리까지 입력해 주세요.");
    const issue = onSave(mode, rate);
    if (issue) setError(issue);
    else onClose();
  }
  return (
    <Dialog title="세금 설정" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <p className="muted">선택한 세율은 이 시나리오의 각 입금액에 적용돼요.</p>
        <label className="field">
          세금 방식
          <select value={mode} onChange={(event) => {
            const value = event.target.value;
            setMode(value === "withholding-3.3" || value === "custom" ? value : "none");
          }}>
            <option value="none">적용 안 함</option>
            <option value="withholding-3.3">3.3% 원천징수</option>
            <option value="custom">직접 입력</option>
          </select>
        </label>
        {mode === "custom" && (
          <label className="field">
            세율 (%)
            <input name="rate" inputMode="decimal" defaultValue={scenario.customTaxBasisPoints === undefined ? "" : scenario.customTaxBasisPoints / 100} placeholder="예: 3.3" required />
          </label>
        )}
        <FormActions error={error} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
