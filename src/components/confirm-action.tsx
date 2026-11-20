import { useState } from "react";
import { Dialog } from "./dialog";

export function ConfirmAction({ title, description, actionLabel, onConfirm, onClose }: {
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => string | void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="muted">{description}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
        <button type="button" className="btn btn-danger" onClick={() => {
          const issue = onConfirm();
          if (issue) setError(issue);
          else onClose();
        }}>{actionLabel}</button>
      </div>
    </Dialog>
  );
}
