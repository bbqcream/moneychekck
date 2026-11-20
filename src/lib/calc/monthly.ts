import type { Item, MonthlyRule, PayEvent, RangeAmount, Scenario } from "@/types/scenario";

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith("0000");
}

export function splitSavingsAmount(amount: RangeAmount, savingsPercent: number) {
  const ratio = BigInt(savingsPercent);
  const savings = {
    min: Number(BigInt(amount.min) * ratio / 100n),
    max: Number(BigInt(amount.max) * ratio / 100n),
  };
  return {
    savings,
    investment: { min: amount.min - savings.min, max: amount.max - savings.max },
  };
}

function rateForMonth(rule: MonthlyRule, month: string) {
  return [...rule.rates].sort((a, b) => a.startMonth.localeCompare(b.startMonth))
    .findLast(({ startMonth }) => startMonth <= month);
}

export function monthlyItems(scenario: Pick<Scenario, "monthlyExpenses" | "monthlySavings">, events: PayEvent[]) {
  const byMonth = new Map<string, PayEvent>();
  for (const event of events) {
    if (!event.date) continue;
    const month = event.date.slice(0, 7);
    const previous = byMonth.get(month);
    if (!previous || (previous.certainty === "uncertain" && event.certainty === "confirmed")) {
      byMonth.set(month, event);
    }
  }

  type MonthlyItem = { item: Item; monthlyRuleId: string };
  const byEvent = new Map<string, MonthlyItem[]>();
  for (const [month, event] of byMonth) {
    const items: MonthlyItem[] = [];
    const add = (rule: MonthlyRule, kind: Item["kind"], label: string, amount: RangeAmount) => {
      if (amount.max === 0) return;
      const item: Item = {
        id: "monthly-" + kind + "-" + rule.id + "-" + month,
        label,
        kind,
        priority: rule.priority,
        amount,
        afterEventId: event.id,
        order: items.length,
      };
      items.push({ item, monthlyRuleId: rule.id });
    };
    for (const expense of scenario.monthlyExpenses ?? []) {
      const rate = rateForMonth(expense, month);
      if (rate) add(expense, "expense", expense.label, rate.amount);
    }
    for (const saving of scenario.monthlySavings ?? []) {
      const rate = rateForMonth(saving, month);
      if (!rate) continue;
      const { savingsPercent, savingsLabel, investmentLabel } = saving.allocation;
      const { savings, investment } = splitSavingsAmount(rate.amount, savingsPercent);
      add(saving, "saving", savingsLabel, savings);
      add(saving, "investment", investmentLabel, investment);
    }
    byEvent.set(event.id, items);
  }
  return byEvent;
}
