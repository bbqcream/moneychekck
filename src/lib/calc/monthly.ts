import type { Item, MonthlyRule, MonthlySalary, PayEvent, RangeAmount, Scenario } from "@/types/scenario";

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith("0000");
}

export const maxSalaryMonths = 120;

export function isSalaryPeriod(startMonth: string, endMonth: string) {
  if (!isMonth(startMonth) || !isMonth(endMonth) || startMonth > endMonth) return false;
  const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5));
  return monthIndex(endMonth) - monthIndex(startMonth) < maxSalaryMonths;
}

export function monthlySalaryEvents(salary?: MonthlySalary): PayEvent[] {
  if (!salary) return [];
  const events: PayEvent[] = [];
  const month = new Date(salary.startMonth + "-01T00:00:00Z");
  const last = new Date(salary.endMonth + "-01T00:00:00Z");
  for (; month <= last; month.setUTCMonth(month.getUTCMonth() + 1)) {
    const yearMonth = month.toISOString().slice(0, 7);
    const monthEnd = new Date(month);
    monthEnd.setUTCMonth(month.getUTCMonth() + 1, 0);
    const day = String(Math.min(salary.day, monthEnd.getUTCDate())).padStart(2, "0");
    events.push({
      id: "monthly-salary:" + yearMonth,
      label: salary.label,
      date: yearMonth + "-" + day,
      amount: { min: salary.amount, max: salary.amount },
      certainty: "confirmed",
    });
  }
  return events;
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
