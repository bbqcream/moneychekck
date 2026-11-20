import type { IncomeFilter, ItemKind } from "@/types/scenario";

export const kindLabels: Record<ItemKind, string> = {
  expense: "지출",
  saving: "저축",
  investment: "투자",
  debt: "상환",
  transfer: "송금",
};

export const incomeFilters: Record<IncomeFilter, string> = {
  all: "전체 입금",
  confirmed: "확실한 돈만",
};
