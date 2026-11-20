import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FormActions } from "@/components/form-actions";
import type { Item, PayEvent } from "@/types/scenario";

export function ItemMoveDialog({ item, events, onMove, onClose }: {
  item: Item;
  events: PayEvent[];
  onMove: (item: Item, eventId: string) => string | null;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const destinations = events.filter(({ id }) => id !== item.afterEventId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = new FormData(event.currentTarget).get("eventId");
    if (typeof id !== "string" || !destinations.some((entry) => entry.id === id)) return;
    const issue = onMove(item, id);
    if (issue) setError(issue);
    else onClose();
  }

  return (
    <Dialog title="다른 입금으로 이동" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <p className="muted">{item.label}</p>
        <label className="field">이동할 입금
          <select name="eventId" required>
            {destinations.map(({ id, label, date }) => <option key={id} value={id}>{label} · {date ?? "날짜 미정"}</option>)}
          </select>
        </label>
        <FormActions error={error} onCancel={onClose} label="이동" />
      </form>
    </Dialog>
  );
}
