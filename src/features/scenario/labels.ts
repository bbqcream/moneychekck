import type { IncomeFilter, ItemKind, SpendingPriority } from "@/types/scenario";

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

export const priorityLabels: Record<SpendingPriority, string> = {
  P1: "P1 필수",
  P2: "P2 중요",
  P3: "P3 선택",
};
