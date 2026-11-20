import type { ItemKind, Scenario } from "@/types/scenario";

const salary = "example-salary";
const expenses: [string, ItemKind, number, number][] = [
  ["12만원 갚기", "debt", 120000, 120000],
  ["일렉 Yamaha Pacifica PAC112V", "expense", 400000, 400000],
  ["AT2020 중고", "expense", 50000, 75000],
  ["오인페", "expense", 220000, 220000],
  ["케이블", "expense", 30000, 50000],
];

export const examplePlan: Pick<Scenario, "events" | "items" | "taxMode"> = {
  events: [
    { id: salary, label: "회사 월급", certainty: "confirmed", date: "2026-11-25", amount: { min: 960000, max: 960000 } },
    { id: "example-grant", label: "지원금", certainty: "uncertain", date: null, amount: { min: 150000, max: 250000 } },
  ],
  items: expenses.map(([label, kind, min, max], order) => ({
    id: "example-item-" + order, label, kind, amount: { min, max }, afterEventId: salary, order,
  })),
  taxMode: "none",
};
