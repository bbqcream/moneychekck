export type Won = number;
export type RangeAmount = { min: Won; max: Won };
export type Certainty = "confirmed" | "uncertain";
export type IncomeFilter = "all" | "confirmed";

export type PayEvent = {
  id: string;
  label: string;
  amount: RangeAmount;
  date: string | null;
  certainty: Certainty;
  note?: string;
};

export const itemKinds = ["expense", "saving", "investment", "debt", "transfer"] as const;
export type ItemKind = (typeof itemKinds)[number];
export const spendingPriorities = ["P1", "P2", "P3"] as const;
export type SpendingPriority = (typeof spendingPriorities)[number];
export const isSpendingPriority = (value: unknown): value is SpendingPriority =>
  spendingPriorities.some((priority) => priority === value);
export type Repetition = { unit: "daily" | "monthly"; count: number };
export type MonthlyRate = { startMonth: string; amount: RangeAmount };
export type MonthlyRule = { id: string; label: string; rates: MonthlyRate[]; priority?: SpendingPriority };
export type SavingsAllocation = { savingsPercent: number; savingsLabel: string; investmentLabel: string };
export type MonthlySaving = MonthlyRule & { allocation: SavingsAllocation };
export type MonthlyRuleKind = "expense" | "saving";
export type HourlySalary = { hourHundredths: number; hourlyWon: Won } & (
  { schedule: "manual"; days: number } | { schedule: "current-month" | "previous-month" }
);
export type MonthlySalary = { label: string; amount: Won; day: number; startMonth: string; endMonth: string; hourly?: HourlySalary };

export type Item = {
  id: string;
  label: string;
  kind: ItemKind;
  priority?: SpendingPriority;
  amount: RangeAmount;
  note?: string;
  afterEventId: string;
  order: number;
  repetition?: Repetition;
};

export type TaxMode = "none" | "withholding-3.3" | "custom";

export type Scenario = {
  id: string;
  name: string;
  monthScope?: string;
  events: PayEvent[];
  items: Item[];
  monthlySalary?: MonthlySalary;
  monthlyExpenses?: MonthlyRule[];
  monthlySavings?: MonthlySaving[];
  taxMode: TaxMode;
  customTaxBasisPoints?: number;
  createdAt: string;
  updatedAt: string;
};
