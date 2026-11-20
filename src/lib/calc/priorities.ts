import type { Timeline } from "./balance";

const emptyTotal = () => ({ min: 0n, max: 0n, count: 0 });

export function summarizePriorities(timeline: Timeline) {
  const totals = { P1: emptyTotal(), P2: emptyTotal(), P3: emptyTotal(), unassigned: emptyTotal() };
  for (const { items } of timeline.groups) {
    for (const { item, amount } of items) {
      const total = totals[item.priority ?? "unassigned"];
      total.min += BigInt(amount.min);
      total.max += BigInt(amount.max);
      total.count += 1;
    }
  }
  return totals;
}
