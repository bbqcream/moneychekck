import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Item } from "@/types/scenario";

type Gesture = {
  item: Item;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

function dropTarget(gesture: Gesture) {
  const id = document.elementFromPoint(gesture.x, gesture.y)
    ?.closest<HTMLElement>("[data-drop-event]")?.dataset.dropEvent;
  return id && id !== gesture.item.afterEventId ? id : undefined;
}

export function useItemDrag(onMove: (item: Item, eventId: string) => void) {
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const dragged = useRef(false);
  const [draggedId, setDraggedId] = useState<string>();
  const [targetId, setTargetId] = useState<string>();

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function trackScroll() {
    const active = gesture.current;
    if (!active) return;
    const edge = 64;
    const height = window.visualViewport?.height ?? window.innerHeight;
    if (active.y < edge) window.scrollBy(0, -12);
    else if (active.y > height - edge) window.scrollBy(0, 12);
    setTargetId(dropTarget(active));
    frame.current = requestAnimationFrame(trackScroll);
  }

  function finish(event: PointerEvent<HTMLButtonElement>, drop: boolean) {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    setDraggedId(undefined);
    setTargetId(undefined);
    if (!drop || !dragged.current) return;
    const destination = dropTarget({ ...active, x: event.clientX, y: event.clientY });
    if (destination) onMove(active.item, destination);
  }

  function handle(item: Item, open: (item: Item) => void) {
    return {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (!event.isPrimary || event.button !== 0) return;
        dragged.current = false;
        const { clientX: x, clientY: y, pointerId } = event;
        gesture.current = { item, pointerId, x, y, startX: x, startY: y };
        event.currentTarget.setPointerCapture(pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const active = gesture.current;
        if (!active || event.pointerId !== active.pointerId) return;
        active.x = event.clientX;
        active.y = event.clientY;
        if (!dragged.current && Math.hypot(active.x - active.startX, active.y - active.startY) >= 7) {
          dragged.current = true;
          setDraggedId(item.id);
          trackScroll();
        }
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, false),
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, false),
      onClick(event: { detail: number }) {
        if (event.detail > 0 && dragged.current) return;
        open(item);
      },
    };
  }

  return { draggedId, targetId, handle };
}
