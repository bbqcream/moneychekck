import type { Scenario } from "@/types/scenario";

export const paycheck: Scenario = {
  id: "plan",
  name: "월급 계획",
  events: [
    { id: "salary", label: "회사 월급", amount: { min: 960000, max: 960000 }, date: "2026-11-25", certainty: "confirmed" },
  ],
  items: [
    { id: "debt", label: "12만원 갚기", kind: "debt", amount: { min: 120000, max: 120000 }, afterEventId: "salary", order: 0 },
    { id: "guitar", label: "일렉 Yamaha Pacifica PAC112V", kind: "expense", amount: { min: 400000, max: 400000 }, afterEventId: "salary", order: 1 },
    { id: "mic", label: "AT2020 중고", kind: "expense", amount: { min: 50000, max: 75000 }, afterEventId: "salary", order: 2 },
    { id: "interface", label: "오인페", kind: "expense", amount: { min: 220000, max: 220000 }, afterEventId: "salary", order: 3 },
    { id: "cable", label: "케이블", kind: "expense", amount: { min: 30000, max: 50000 }, afterEventId: "salary", order: 4 },
  ],
  taxMode: "none",
  createdAt: "2026-11-20T00:00:00.000Z",
  updatedAt: "2026-11-20T00:00:00.000Z",
};
