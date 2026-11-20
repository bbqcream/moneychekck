import { useRef, useState } from "react";
import { Dialog } from "@/components/dialog";

export function MemoDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("메모 텍스트를 복사했어요.");
    } catch {
      field.current?.focus();
      field.current?.select();
      setStatus("텍스트를 선택했어요. 기기의 복사 기능을 사용해 주세요.");
    }
  }
  return (
    <Dialog title="아이폰 메모로 내보내기" onClose={onClose}>
      <div className="form-stack">
        <p className="muted">아래 내용을 복사해 메모 앱에 붙여넣으세요. 금액 단위는 만원이에요.</p>
        <textarea className="memo-text" aria-label="메모 내보내기 텍스트" rows={11} ref={field} value={text} readOnly />
        {status && <p role="status" className="muted">{status}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
          <button type="button" className="btn btn-primary" onClick={copy}>텍스트 복사</button>
        </div>
      </div>
    </Dialog>
  );
}
