"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return (
    <dialog className="dialog" ref={dialog} aria-labelledby={titleId} onClose={onClose}>
      <div className="dialog-inner">
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-quiet dialog-close" aria-label="닫기" onClick={() => dialog.current?.close()}>×</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
