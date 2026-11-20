import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";

export function NameDialog({ title, name, onSave, onClose }: {
  title: string;
  name?: string;
  onSave: (name: string) => string | void | null;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!value) return setError("시나리오 이름을 입력해 주세요.");
    const issue = onSave(value);
    if (issue) setError(issue);
    else onClose();
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">
          시나리오 이름
          <input name="name" maxLength={80} defaultValue={name} placeholder="예: 12월 월급 계획" required />
        </label>
        <FormActions error={error} label={name ? "이름 저장" : "시나리오 만들기"} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
