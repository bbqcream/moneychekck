import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { formatManwon, parseManwon, parseScaled } from "@/lib/calc/money";
import { calculateWorkPay, countWorkdays, parseWorkHours } from "@/lib/calc/work-pay";

export function WorkPayDialog({ onUse, onClose }: { onUse: (won: number) => void; onClose: () => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [manualDays, setManualDays] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const calendar = countWorkdays(from, to);
  const days = manualDays ?? (calendar ? String(calendar.days) : "");
  const workdays = parseScaled(days, 0);
  const workHours = parseWorkHours(hours);
  const hourlyWon = parseManwon(rate);
  let won: number | null = null;
  let calculationError = "";
  if (workdays !== null && workHours !== null && hourlyWon !== null) {
    try {
      won = calculateWorkPay(workdays, workHours, hourlyWon);
    } catch (error) {
      if (error instanceof RangeError) calculationError = error.message;
      else throw error;
    }
  }
  return (
    <Dialog title="근무수당 계산기" onClose={onClose}>
      <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        if (won !== null) onUse(won);
      }}>
        <p className="muted">기간을 선택하면 주말과 공휴일을 뺀 근무일수를 채워요. 근무일을 직접 입력해도 돼요.</p>
        <div className="form-grid">
          <label className="field">시작일<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field">마지막 근무일<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        {from && to && !calendar && <p className="form-error" role="alert">마지막 근무일은 시작일과 같거나 이후여야 해요.</p>}
        {!!calendar?.missingYears.length && <p className="notice" role="status">선택 기간의 일부 연도에 공휴일 데이터가 없어요. 해당 연도는 주말만 제외했으니 근무일수를 확인해 주세요.</p>}
        <label className="field">
          근무일수
          <input inputMode="numeric" value={days} onChange={(event) => setManualDays(event.target.value)} placeholder="예: 16" required />
        </label>
        {manualDays !== null && calendar && (
          <button type="button" className="btn btn-secondary self-start" onClick={() => setManualDays(null)}>
            달력 계산값 {calendar.days}일 사용
          </button>
        )}
        <div className="form-grid">
          <label className="field">하루 근무시간<input inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="예: 6" required /></label>
          <label className="field">시급 (만원)<input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="예: 1" required /></label>
        </div>
        {((days && workdays === null) || (hours && workHours === null) || (rate && hourlyWon === null)) && (
          <p className="form-error" role="alert">근무일수는 정수, 하루 근무시간은 0~24시간, 시급은 0 이상의 금액을 입력해 주세요.</p>
        )}
        {calculationError && <p className="form-error" role="alert">{calculationError}</p>}
        <div className="work-result" aria-live="polite">
          <span>세전 근무수당</span>
          <strong title={won === null ? undefined : won.toLocaleString("ko-KR") + "원"}>{won === null ? "—" : formatManwon(won) + " 만원"}</strong>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
          <button type="submit" className="btn btn-primary" disabled={won === null || Boolean(from && to && !calendar)}>입금 금액으로 사용</button>
        </div>
      </form>
    </Dialog>
  );
}
