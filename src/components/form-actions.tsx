export function FormActions({ error, label = "저장", onCancel }: { error: string; label?: string; onCancel: () => void }) {
  return (
    <>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>취소</button>
        <button type="submit" className="btn btn-primary">{label}</button>
      </div>
    </>
  );
}
