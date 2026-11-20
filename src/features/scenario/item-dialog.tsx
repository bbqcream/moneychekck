import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { RangeFields } from "@/components/range-fields";
import { FormActions } from "@/components/form-actions";
import { parseRange, parseScaled } from "@/lib/calc/money";
import { createId } from "@/lib/create-id";
import { itemKinds, type Item, type Repetition } from "@/types/scenario";
import { kindLabels } from "./labels";

type ItemInput = Omit<Item, "afterEventId" | "order">;

export function ItemDialog({ item, eventLabel, onSave, onClose }: {
  item?: Item;
  eventLabel: string;
  onSave: (item: ItemInput) => string | null;
  onClose: () => void;
}) {
  const [repeat, setRepeat] = useState<"once" | Repetition["unit"]>(item?.repetition?.unit ?? "once");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    const amount = parseRange(String(data.get("min") ?? ""), String(data.get("max") ?? ""));
    const note = String(data.get("note") ?? "").trim();
    const kind = itemKinds.find((kind) => kind === data.get("kind"));
    const count = repeat === "once" ? 1 : parseScaled(String(data.get("count") ?? ""), 0);
    if (!label) return setError("항목 이름을 입력해 주세요.");
    if (!amount) return setError("0 이상의 만원 금액을 입력해 주세요. 최대는 최소 이상이어야 해요.");
    if (!kind) return setError("항목 종류를 선택해 주세요.");
    if (!count) return setError("반복 횟수를 1 이상의 정수로 입력해 주세요.");
    const issue = onSave({
      id: item?.id ?? createId(),
      kind,
      label,
      note: note || undefined,
      amount,
      repetition: repeat === "once" ? undefined : { unit: repeat, count },
    });
    if (issue) setError(issue);
    else onClose();
  }
  return (
    <Dialog title={item ? "항목 수정" : "항목 추가"} onClose={onClose}>
      <p className="muted dialog-context">{eventLabel} 입금 후</p>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid form-grid-wide">
          <label className="field">
            항목 이름
            <input name="label" defaultValue={item?.label} placeholder="예: 중고 마이크" maxLength={120} required />
          </label>
          <label className="field">
            종류
            <select name="kind" defaultValue={item?.kind ?? "expense"}>
              {itemKinds.map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            반복
            <select value={repeat} onChange={(event) => {
              const value = event.target.value;
              setRepeat(value === "daily" || value === "monthly" ? value : "once");
            }}>
              <option value="once">한 번</option>
              <option value="daily">매일</option>
              <option value="monthly">매달</option>
            </select>
          </label>
          {repeat !== "once" && (
            <label className="field">
              {repeat === "daily" ? "일수" : "개월 수"}
              <input name="count" inputMode="numeric" defaultValue={item?.repetition?.count ?? 1} required />
            </label>
          )}
        </div>
        <RangeFields amount={item?.amount} label={repeat === "daily" ? "하루 금액" : repeat === "monthly" ? "한 달 금액" : "금액"} />
        <label className="field">
          메모 <span className="optional">선택</span>
          <textarea name="note" rows={2} defaultValue={item?.note} maxLength={500} />
        </label>
        <FormActions error={error} label={item ? "항목 저장" : "항목 추가"} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
