import type { Item, MonthlyExpense, PayEvent } from "@/types/scenario";

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith("0000");
}

export function monthlyItems(expenses: MonthlyExpense[], events: PayEvent[]) {
  const byMonth = new Map<string, PayEvent>();
  for (const event of events) {
    if (!event.date) continue;
    const month = event.date.slice(0, 7);
    const previous = byMonth.get(month);
    if (!previous || (previous.certainty === "uncertain" && event.certainty === "confirmed")) {
      byMonth.set(month, event);
    }
  }

  const byEvent = new Map<string, { item: Item; fixedExpenseId: string }[]>();
  for (const [month, event] of byMonth) {
    const items = expenses.flatMap((expense, order) => {
      const rate = [...expense.rates].sort((a, b) => a.startMonth.localeCompare(b.startMonth))
        .findLast(({ startMonth }) => startMonth <= month);
      if (!rate || rate.amount.max === 0) return [];
      const item: Item = {
        id: "monthly-" + expense.id + "-" + month,
        label: expense.label,
        kind: "expense",
        priority: expense.priority,
        amount: rate.amount,
        afterEventId: event.id,
        order,
      };
      return [{ item, fixedExpenseId: expense.id }];
    });
    byEvent.set(event.id, items);
  }
  return byEvent;
}
