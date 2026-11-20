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
export type Repetition = { unit: "daily" | "monthly"; count: number };
export type MonthlyRate = { startMonth: string; amount: RangeAmount };
export type MonthlyExpense = { id: string; label: string; rates: MonthlyRate[] };

export type Item = {
  id: string;
  label: string;
  kind: ItemKind;
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
  events: PayEvent[];
  items: Item[];
  monthlyExpenses?: MonthlyExpense[];
  taxMode: TaxMode;
  customTaxBasisPoints?: number;
  createdAt: string;
  updatedAt: string;
};
