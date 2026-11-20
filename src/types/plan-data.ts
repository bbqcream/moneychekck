import type { Scenario, Won } from "./scenario";

export type CurrentBalance = { amount: Won; recordedAt: string };

export type PlanData = {
  scenarios: Scenario[];
  currentBalance?: CurrentBalance;
};
