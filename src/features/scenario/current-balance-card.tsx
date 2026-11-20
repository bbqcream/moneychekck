import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { parseScaled } from "@/lib/calc/money";
import { usePlans } from "@/store/provider";

const recordedTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

export function CurrentBalanceCard() {
  const balance = usePlans((state) => state.data.currentBalance);
  const save = usePlans((state) => state.setCurrentBalance);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const close = () => setEditing(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseScaled(String(new FormData(event.currentTarget).get("amount") ?? ""), 0);
    if (amount === null) {
      setError("현재 잔고를 0 이상의 정수로 입력해 주세요.");
      return;
    }
    save(amount);
    close();
  }

  return (
    <section className="panel p-4" aria-label="현재 잔고">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base!">현재 잔고</h2>
        <button type="button" className="btn btn-secondary" onClick={() => {
          setError("");
          setEditing(true);
        }}>{balance ? "잔고 수정" : "잔고 입력"}</button>
      </div>
      {balance ? (
        <>
          <p className="mt-2 text-2xl font-bold wrap-anywhere">{balance.amount.toLocaleString("ko-KR")}원</p>
          <p className="meta mt-1">직접 입력 · <time dateTime={balance.recordedAt}>{recordedTime.format(new Date(balance.recordedAt))}</time></p>
        </>
      ) : <p className="meta mt-1">토스에서 확인한 잔고를 입력해 보세요.</p>}
      {editing && (
        <Dialog title="현재 잔고 입력" onClose={close}>
          <form className="form-stack" onSubmit={submit}>
            <label className="field">
              현재 잔고 (원)
              <input name="amount" inputMode="numeric" defaultValue={balance?.amount} placeholder="예: 125000" required />
            </label>
            {balance && <button type="button" className="btn btn-quiet danger-text self-start" onClick={() => {
              save(undefined);
              close();
            }}>잔고 지우기</button>}
            <FormActions error={error} onCancel={close} />
          </form>
        </Dialog>
      )}
    </section>
  );
}
