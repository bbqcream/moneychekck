import type { Balance, Timeline, TimelineItem } from "./balance";

type ComparedItem = TimelineItem & { eventLabel: string };
type ComparisonRow = {
  key: string;
  left?: ComparedItem;
  right?: ComparedItem;
  difference?: ReturnType<typeof balanceDifference>;
};

export function balanceDifference(left: Balance, right: Balance) {
  return {
    best: BigInt(right.best) - BigInt(left.best),
    worst: BigInt(right.worst) - BigInt(left.worst),
  };
}

function indexItems(timeline: Timeline) {
  const items = new Map<string, ComparedItem>();
  const counts = new Map<string, number>();
  for (const group of timeline.groups) {
    for (const item of group.items) {
      const label = item.item.label.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
      const name = JSON.stringify([item.item.kind, label]);
      const occurrence = (counts.get(name) ?? 0) + 1;
      counts.set(name, occurrence);
      items.set(name + ":" + occurrence, { ...item, eventLabel: group.event.label });
    }
  }
  return items;
}

export function compareTimelines(left: Timeline, right: Timeline): ComparisonRow[] {
  const leftItems = indexItems(left);
  const rightItems = indexItems(right);
  const keys = new Set([...leftItems.keys(), ...rightItems.keys()]);
  return Array.from(keys, (key) => {
    const a = leftItems.get(key);
    const b = rightItems.get(key);
    return { key, left: a, right: b, difference: a && b ? balanceDifference(a.balance, b.balance) : undefined };
  });
}
