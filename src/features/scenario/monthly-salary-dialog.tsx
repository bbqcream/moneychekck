import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { formatManwon, parseManwon, parseScaled, toManwonInput } from "@/lib/calc/money";
import { isSalaryPeriod, maxSalaryMonths } from "@/lib/calc/monthly";
import { calculateHourlySalary, parseWorkHours } from "@/lib/calc/work-pay";
import type { HourlySalary, MonthlySalary } from "@/types/scenario";

export function MonthlySalaryDialog({ salary, onSave, onClose }: {
  salary?: MonthlySalary;
  onSave: (salary: MonthlySalary) => string | null;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [useHourly, setUseHourly] = useState(!!salary?.hourly);
  const [fixedAmount, setFixedAmount] = useState(salary ? toManwonInput(salary.amount) : "");
  const [startMonth, setStartMonth] = useState(salary?.startMonth ?? "");
  const [schedule, setSchedule] = useState<HourlySalary["schedule"]>(salary?.hourly?.schedule ?? "previous-month");
  const [rate, setRate] = useState(salary?.hourly ? String(salary.hourly.hourlyWon) : "");
  const [hours, setHours] = useState(salary?.hourly ? String(salary.hourly.hourHundredths / 100) : "");
  const [manualDays, setManualDays] = useState(salary?.hourly?.schedule === "manual" ? String(salary.hourly.days) : "");
  const hourlyWon = parseScaled(rate, 0);
  const hourHundredths = parseWorkHours(hours);
  const days = parseScaled(manualDays, 0);
  let hourly: HourlySalary | undefined;
  if (hourlyWon !== null && hourHundredths !== null) {
    if (schedule !== "manual") hourly = { schedule, hourHundredths, hourlyWon };
    else if (days !== null) hourly = { schedule, hourHundredths, hourlyWon, days };
  }
  const preview = useHourly && hourly ? calculateHourlySalary(hourly, startMonth) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    const day = parseScaled(String(data.get("day") ?? ""), 0);
    const endMonth = String(data.get("endMonth") ?? "");
    if (!label) return setError("월급 이름을 입력해 주세요.");
    if (day === null || day < 1 || day > 31) return setError("지급일을 1~31 사이의 날짜로 입력해 주세요.");
    if (!isSalaryPeriod(startMonth, endMonth)) {
      return setError(`첫 지급월과 마지막 지급월을 순서대로 입력해 주세요. 최대 ${maxSalaryMonths}개월까지 설정할 수 있어요.`);
    }
    const amount = useHourly ? preview?.amount : parseManwon(fixedAmount);
    if (amount == null || amount <= 0) {
      return setError(useHourly ? "시급, 하루 근무시간, 근무일수를 확인해 주세요. 계산한 월급은 0원보다 커야 해요." : "월급을 0보다 큰 금액으로 입력해 주세요.");
    }
    const issue = onSave({ label, amount, day, startMonth, endMonth, hourly: useHourly ? hourly : undefined });
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
          <label className="field">월급 입력 방식
            <select name="method" value={useHourly ? "hourly" : "fixed"} onChange={(event) => setUseHourly(event.target.value === "hourly")}>
              <option value="fixed">월급 직접 입력</option>
              <option value="hourly">시급으로 계산</option>
            </select>
          </label>
          <label className="field">매월 지급일 (1~31일)
            <input name="day" inputMode="numeric" defaultValue={salary?.day} required />
          </label>
        </div>
        {useHourly ? (
          <>
            <div className="form-grid">
              <label className="field">시급 (원)
                <input name="hourlyWon" inputMode="numeric" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="예: 10000" required />
              </label>
              <label className="field">하루 근무시간
                <input name="hours" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="예: 6" required />
              </label>
            </div>
            <label className="field">월 근무일수
              <select name="schedule" value={schedule} onChange={(event) => {
                const value = event.target.value;
                if (value === "manual" || value === "current-month" || value === "previous-month") setSchedule(value);
              }}>
                <option value="previous-month">전월 평일로 계산</option>
                <option value="current-month">지급월 평일로 계산</option>
                <option value="manual">근무일수 직접 입력</option>
              </select>
            </label>
            {schedule === "manual" ? (
              <label className="field">매달 일하는 날 (1~31일)
                <input name="manualDays" inputMode="numeric" value={manualDays} onChange={(event) => setManualDays(event.target.value)} placeholder="예: 16" required />
              </label>
            ) : <p className="meta">{schedule === "previous-month" ? "1월 입금액은 12월 근무일수로 계산해요." : "1월 입금액은 1월 근무일수로 계산해요."} 주말과 한국 공휴일은 제외해요.</p>}
          </>
        ) : (
          <label className="field">월급 (만원)
            <input name="amount" inputMode="decimal" value={fixedAmount} onChange={(event) => setFixedAmount(event.target.value)} required />
          </label>
        )}
        <div className="form-grid">
          <label className="field">첫 지급월
            <input name="startMonth" type="month" placeholder="YYYY-MM" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} required />
          </label>
          <label className="field">마지막 지급월
            <input name="endMonth" type="month" placeholder="YYYY-MM" defaultValue={salary?.endMonth} required />
          </label>
        </div>
        {useHourly && (
          <div className="work-result" aria-live="polite">
            <span>{schedule === "manual" ? "세전 월급" : "첫 달 예상 월급 (세전)"}</span>
            <strong>{preview ? `${formatManwon(preview.amount)}만원 · 근무 ${preview.days}일` : "—"}</strong>
            {preview?.missingHolidays && <p className="meta w-full">첫 근무월은 공휴일 자료가 없어 주말만 제외했어요.</p>}
          </div>
        )}
        <p className="meta">입금은 첫 지급월부터 마지막 지급월까지만 잡혀요. 지정한 지급일이 없으면 그달 말일에 반영해요.</p>
        <FormActions error={error} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
