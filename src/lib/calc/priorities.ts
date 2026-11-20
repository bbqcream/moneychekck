import type { Timeline } from "./balance";
import { spendingPriorities, type Item, type RangeAmount } from "@/types/scenario";

const emptyTotal = () => ({ min: 0n, max: 0n, count: 0 });

type BudgetEntry = { item: Item; amount: RangeAmount; budgetDeferred?: true };

export function orderItemsForBudget(entries: BudgetEntry[], available: bigint): BudgetEntry[] {
  const rank = ({ item }: BudgetEntry) => item.priority ? spendingPriorities.indexOf(item.priority) : spendingPriorities.length;
  const sorted = [...entries].sort((left, right) => rank(left) - rank(right));
  const affordable: BudgetEntry[] = [];
  const deferred: BudgetEntry[] = [];
  let remaining = available;
  for (const entry of sorted) {
    const cost = BigInt(entry.amount.max);
    if (cost <= remaining) {
      affordable.push(entry);
      remaining -= cost;
    } else {
      deferred.push({ ...entry, budgetDeferred: true });
    }
  }
  return [...affordable, ...deferred];
}

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
