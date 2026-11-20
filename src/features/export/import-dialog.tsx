import { useState, type ChangeEvent, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import { parsePlanDocument } from "@/lib/storage/local";
import type { PlanData } from "@/types/plan-data";

export function ImportDialog({ onImport, onDownloadExample, onClose }: {
  onImport: (data: PlanData) => void;
  onDownloadExample: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  function importText(contents: string) {
    let data: PlanData;
    try {
      data = parsePlanDocument(contents);
    } catch {
      setError("유효한 페이플랜 JSON을 읽을 수 없어요. 내보낸 파일을 확인해 주세요.");
      return;
    }
    onImport(data);
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reading) importText(text);
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";
    setError("");
    setReading(true);
    try {
      const contents = await file.text();
      if (input.isConnected) importText(contents);
    } catch {
      if (input.isConnected) setError("파일을 열지 못했어요. JSON 내용을 아래에 붙여넣을 수도 있어요.");
    } finally {
      if (input.isConnected) setReading(false);
    }
  }

  return (
    <Dialog title="시나리오 JSON 불러오기" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <p className="muted">파일을 선택하면 안에 있는 시나리오를 한 번에 추가해요. 같은 ID가 있으면 저장된 시나리오를 유지해요.</p>
        <button type="button" className="btn btn-secondary self-start" onClick={onDownloadExample}>예시 JSON 다운로드</button>
        <label className="field">
          JSON 파일
          <input type="file" accept=".json,application/json" disabled={reading} onChange={readFile} />
        </label>
        {reading && <p className="meta" role="status">JSON 파일을 읽고 있어요.</p>}
        <label className="field">
          JSON 내용
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} required />
        </label>
        <FormActions error={error} label="불러오기" onCancel={onClose} />
      </form>
    </Dialog>
  );
}
