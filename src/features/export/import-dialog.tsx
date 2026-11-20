import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { parsePlans } from "@/lib/storage/local";
import type { Scenario } from "@/types/scenario";

export function ImportDialog({ onImport, onClose }: {
  onImport: (plans: Scenario[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let plans: Scenario[];
    try {
      plans = parsePlans(text);
    } catch {
      setError("유효한 페이플랜 JSON을 읽을 수 없어요. 내보낸 파일을 확인해 주세요.");
      return;
    }
    onImport(plans);
    onClose();
  }

  return (
    <Dialog title="시나리오 JSON 불러오기" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <p className="muted">같은 ID의 시나리오가 있으면 현재 저장된 시나리오를 유지해요.</p>
        <label className="field">
          JSON 파일
          <input type="file" accept=".json,application/json" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              setText(await file.text());
              setError("");
            } catch {
              setError("파일을 열지 못했어요. JSON 내용을 아래에 붙여넣을 수도 있어요.");
            }
          }} />
        </label>
        <label className="field">
          JSON 내용
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} required />
        </label>
        <FormActions error={error} label="불러오기" onCancel={onClose} />
      </form>
    </Dialog>
  );
}
