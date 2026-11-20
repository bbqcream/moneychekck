import type { Item, MonthlyRule, MonthlySalary, MonthlySaving, PayEvent, RangeAmount, Scenario } from "@/types/scenario";
import { applyTax } from "./tax";
import { calculateHourlySalary } from "./work-pay";

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
    const pay = salary.hourly && calculateHourlySalary(salary.hourly, yearMonth);
    if (pay === null) throw new RangeError("시급으로 계산한 월급이 유효한 범위를 벗어났어요.");
    const amount = pay?.amount ?? salary.amount;
    const event: PayEvent = {
      id: "monthly-salary:" + yearMonth,
      label: salary.label,
      date: yearMonth + "-" + day,
      amount: { min: amount, max: amount },
      certainty: "confirmed",
    };
    if (pay) {
      const period = pay.workMonth ? pay.workMonth + " 근무" : "월 근무";
      event.note = `${period} ${pay.days}일` + (pay.missingHolidays ? " · 공휴일 자료가 없어 주말만 제외" : "");
    }
    events.push(event);
  }
  return events;
}

function percentAmount(amount: RangeAmount, percent: number): RangeAmount {
  const ratio = BigInt(percent);
  return {
    min: Number(BigInt(amount.min) * ratio / 100n),
    max: Number(BigInt(amount.max) * ratio / 100n),
  };
}

export function splitSavingsAmount(amount: RangeAmount, savingsPercent: number) {
  const savings = percentAmount(amount, savingsPercent);
  return {
    savings,
    investment: { min: amount.min - savings.min, max: amount.max - savings.max },
  };
}

function rateForMonth<T extends { startMonth: string }>(rates: T[], month: string) {
  return [...rates].sort((a, b) => a.startMonth.localeCompare(b.startMonth))
    .findLast(({ startMonth }) => startMonth <= month);
}

export function monthlyItems(scenario: Scenario, events: PayEvent[], salaryEvents: PayEvent[]) {
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
  const salaryByMonth = new Map(salaryEvents.map((salary) => [salary.date?.slice(0, 7), salary]));
  for (const [month, event] of byMonth) {
    const add = (target: PayEvent, rule: MonthlyRule | MonthlySaving, kind: Item["kind"], label: string, amount: RangeAmount) => {
      if (amount.max === 0) return;
      const items = byEvent.get(target.id) ?? [];
      const item: Item = {
        id: "monthly-" + kind + "-" + rule.id + "-" + month,
        label,
        kind,
        priority: rule.priority,
        amount,
        afterEventId: target.id,
        order: items.length,
      };
      items.push({ item, monthlyRuleId: rule.id });
      byEvent.set(target.id, items);
    };
    for (const expense of scenario.monthlyExpenses ?? []) {
      const rate = rateForMonth(expense.rates, month);
      if (rate) add(event, expense, "expense", expense.label, rate.amount);
    }
    for (const saving of scenario.monthlySavings ?? []) {
      const rate = rateForMonth(saving.rates, month);
      if (!rate) continue;
      const target = "salaryPercent" in rate ? salaryByMonth.get(month) : event;
      if (!target) continue;
      const amount = "salaryPercent" in rate
        ? percentAmount(applyTax(target.amount, scenario.taxMode, scenario.customTaxBasisPoints), rate.salaryPercent)
        : rate.amount;
      const { savingsPercent, savingsLabel, investmentLabel } = saving.allocation;
      const { savings, investment } = splitSavingsAmount(amount, savingsPercent);
      add(target, saving, "saving", savingsLabel, savings);
      add(target, saving, "investment", investmentLabel, investment);
    }
  }
  return byEvent;
}
