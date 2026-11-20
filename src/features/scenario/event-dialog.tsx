import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { RangeFields } from "@/components/range-fields";
import { parseRange } from "@/lib/calc/money";
import { parseCalendarDate } from "@/lib/calc/work-pay";
import { createId } from "@/lib/create-id";
import type { PayEvent, RangeAmount } from "@/types/scenario";

export function EventDialog({ event, draftAmount, onSave, onClose }: {
  event?: PayEvent;
  draftAmount?: RangeAmount;
  onSave: (event: PayEvent) => string | null;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    const data = new FormData(submission.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    const date = String(data.get("date") ?? "");
    const note = String(data.get("note") ?? "").trim();
    const amount = parseRange(String(data.get("min") ?? ""), String(data.get("max") ?? ""));
    if (!label) return setError("입금 이름을 입력해 주세요.");
    if (date && !parseCalendarDate(date)) return setError("올바른 입금일을 입력해 주세요.");
    if (!amount) return setError("0 이상의 만원 금액을 입력해 주세요. 최대는 최소 이상이어야 해요.");
    const issue = onSave({
      id: event?.id ?? createId(),
      label,
      amount,
      date: date || null,
      certainty: data.get("certainty") === "uncertain" ? "uncertain" : "confirmed",
      note: note || undefined,
    });
    if (issue) setError(issue);
    else onClose();
  }
  return (
    <Dialog title={event ? "입금 수정" : "입금 추가"} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">
          입금 이름
          <input name="label" defaultValue={event?.label ?? (draftAmount ? "근무수당" : "")} placeholder="예: 회사 월급" maxLength={120} required />
        </label>
        <RangeFields amount={event?.amount ?? draftAmount} label="입금액" />
        <div className="form-grid">
          <label className="field">
            입금일 <span className="optional">비우면 시기 미정</span>
            <input type="date" name="date" defaultValue={event?.date ?? ""} />
          </label>
          <label className="field">
            확실성
            <select name="certainty" defaultValue={event?.certainty ?? "confirmed"}>
              <option value="confirmed">확실</option>
              <option value="uncertain">미정</option>
            </select>
          </label>
        </div>
        <label className="field">
          메모 <span className="optional">선택</span>
          <textarea name="note" rows={2} maxLength={500} defaultValue={event?.note} />
        </label>
        <FormActions error={error} label={event ? "입금 저장" : "입금 추가"} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
