import type { IncomeFilter, Item, PayEvent, RangeAmount, Scenario, Won } from "@/types/scenario";
import { checkedWon, formatManwon } from "./money";
import { totalItemAmount } from "./range";
import { monthlyItems, monthlySalaryEvents } from "./monthly";
import { orderItemsForBudget } from "./priorities";
import { applyTax } from "./tax";

export type Balance = { best: Won; worst: Won; shortage: boolean };
export type TimelineItem = { item: Item; amount: RangeAmount; balance: Balance; monthlyRuleId?: string; budgetDeferred?: true };
export type TimelineGroup = { event: PayEvent; amount: RangeAmount; balance: Balance; items: TimelineItem[]; monthlySalary?: true };
export type Timeline = { groups: TimelineGroup[]; finalBalance: Balance };
export type TimelineOrder = "input" | "budget";

export function formatBalance(balance: { best: number | bigint; worst: number | bigint }, signed = false): string {
  const best = formatManwon(balance.best, signed);
  return balance.best === balance.worst ? best : best + " ~ " + formatManwon(balance.worst, signed);
}

export function itemsForEvent(items: Item[], eventId: string): Item[] {
  return items.filter((item) => item.afterEventId === eventId).sort((a, b) => a.order - b.order);
}

export function calculateTimeline(scenario: Scenario, filter: IncomeFilter = "all", order: TimelineOrder = "input"): Timeline {
  const salaryEvents = monthlySalaryEvents(scenario.monthlySalary);
  const salaryIds = new Set(salaryEvents.map(({ id }) => id));
  const events = [...scenario.events, ...salaryEvents]
    .filter((event) => filter === "all" || event.certainty === "confirmed")
    .sort((a, b) => (a.date ?? "9999-12-32").localeCompare(b.date ?? "9999-12-32"));
  const fixed = scenario.monthlyExpenses?.length || scenario.monthlySavings?.length
    ? monthlyItems(scenario, events, salaryEvents)
    : undefined;

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
    function applyItem(entry: Omit<TimelineItem, "balance">): TimelineItem {
      best -= BigInt(entry.amount.min);
      worst -= BigInt(entry.amount.max);
      return { ...entry, balance: balance() };
    }
    const fixedItems = (fixed?.get(event.id) ?? [])
      .map(({ item, monthlyRuleId }) => applyItem({ item, amount: totalItemAmount(item), monthlyRuleId }));
    const planned = itemsForEvent(scenario.items, event.id).map((item) => ({ item, amount: totalItemAmount(item) }));
    const ordered = order === "budget" ? orderItemsForBudget(planned, worst) : planned;
    const items = [...fixedItems, ...ordered.map(applyItem)];
    const group: TimelineGroup = { event, amount, balance: afterIncome, items };
    if (salaryIds.has(event.id)) group.monthlySalary = true;
    return group;
  });

  return { groups, finalBalance: balance() };
}
