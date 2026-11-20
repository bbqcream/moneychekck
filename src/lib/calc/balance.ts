import type { IncomeFilter, Item, PayEvent, RangeAmount, Scenario, Won } from "@/types/scenario";
import { checkedWon, formatManwon } from "./money";
import { totalItemAmount } from "./range";
import { applyTax } from "./tax";

export type Balance = { best: Won; worst: Won; shortage: boolean };
export type TimelineItem = { item: Item; amount: RangeAmount; balance: Balance };
export type TimelineGroup = { event: PayEvent; amount: RangeAmount; balance: Balance; items: TimelineItem[] };
export type Timeline = { groups: TimelineGroup[]; finalBalance: Balance };

export function formatBalance(balance: { best: number | bigint; worst: number | bigint }, signed = false): string {
  const best = formatManwon(balance.best, signed);
  return balance.best === balance.worst ? best : best + " ~ " + formatManwon(balance.worst, signed);
}

export function itemsForEvent(items: Item[], eventId: string): Item[] {
  return items.filter((item) => item.afterEventId === eventId).sort((a, b) => a.order - b.order);
}

export function calculateTimeline(scenario: Scenario, filter: IncomeFilter = "all"): Timeline {
  const events = scenario.events
    .filter((event) => filter === "all" || event.certainty === "confirmed")
    .sort((a, b) => (a.date ?? "9999-12-32").localeCompare(b.date ?? "9999-12-32"));

  let best = 0n;
  let worst = 0n;
  const balance = (): Balance => ({
    best: checkedWon(best),
    worst: checkedWon(worst),
    shortage: worst < 0n,
  });

  const groups = events.map((event): TimelineGroup => {
    const amount = applyTax(event.amount, scenario.taxMode, scenario.customTaxBasisPoints);
    best += BigInt(amount.max);
    worst += BigInt(amount.min);
    const afterIncome = balance();
    const items = itemsForEvent(scenario.items, event.id).map((item) => {
      const total = totalItemAmount(item);
      best -= BigInt(total.min);
      worst -= BigInt(total.max);
      return { item, amount: total, balance: balance() };
    });
    return { event, amount, balance: afterIncome, items };
  });

  return { groups, finalBalance: balance() };
}
