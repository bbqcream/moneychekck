import type { AdviceBudget, SavingsAdvice } from "../../../supabase/functions/savings-advice/contract";
import type { Scenario, Won } from "@/types/scenario";
import { calculateTimeline } from "./balance";

export function analyzeSavings(scenario: Scenario, reserveWon: Won) {
  const { groups, finalBalance } = calculateTimeline(scenario, "confirmed");
  let income = 0n;
  let spending = 0n;
  let savings = 0n;
  let investment = 0n;
  let hasShortfall = false;

  for (const group of groups) {
    income += BigInt(group.amount.min);
    hasShortfall ||= group.balance.shortage;
    for (const { item, amount, balance } of group.items) {
      const maximum = BigInt(amount.max);
      if (item.kind === "saving") savings += maximum;
      else if (item.kind === "investment") investment += maximum;
      else spending += maximum;
      hasShortfall ||= balance.shortage;
    }
  }

  const remaining = BigInt(finalBalance.worst) - BigInt(reserveWon);
  const budget: AdviceBudget = {
    incomeWon: income.toString(),
    spendingWon: spending.toString(),
    savingsWon: savings.toString(),
    investmentWon: investment.toString(),
    reserveWon,
    limitWon: !hasShortfall && remaining > 0n ? Number(remaining) : 0,
    hasShortfall,
  };
  return { budget, confirmedCount: groups.length, excludedCount: scenario.events.length - groups.length };
}

export function advicePercentages(advice: SavingsAdvice) {
  const savings = BigInt(advice.savingsWon);
  const total = savings + BigInt(advice.investmentWon);
  if (total === 0n) return undefined;
  const savingsPercent = Number((savings * 100n + total / 2n) / total);
  return { savings: savingsPercent, investment: 100 - savingsPercent };
}
