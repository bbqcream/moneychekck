import { describe, expect, it } from "vitest";
import { calculateTimeline } from "@/lib/calc/balance";
import { compareTimelines } from "@/lib/calc/compare";
import { formatManwon, parseManwon, parseRange } from "@/lib/calc/money";
import { applyTax, parseTaxRate } from "@/lib/calc/tax";
import { calculateWorkPay, countWorkdays, parseWorkHours } from "@/lib/calc/work-pay";
import { formatMemo } from "@/features/export/memo";
import type { PayEvent } from "@/types/scenario";
import { paycheck } from "./fixtures/paycheck";

const grant: PayEvent = {
  id: "grant",
  label: "지원금",
  amount: { min: 150000, max: 250000 },
  date: null,
  certainty: "uncertain",
};

describe("잔액 타임라인", () => {
  it("96만원 입금부터 각 항목 직후의 best와 worst를 계산한다", () => {
    const timeline = calculateTimeline(paycheck);
    expect(timeline.groups[0].balance).toMatchObject({ best: 960000, worst: 960000 });
    expect(timeline.groups[0].items.map(({ balance }) => [balance.best, balance.worst])).toEqual([
      [840000, 840000],
      [440000, 440000],
      [390000, 365000],
      [170000, 145000],
      [140000, 95000],
    ]);
  });

  it("확정 금액만 있으면 두 잔액이 같다", () => {
    expect(calculateTimeline({ ...paycheck, items: paycheck.items.slice(0, 2) }).finalBalance)
      .toEqual({ best: 440000, worst: 440000, shortage: false });
  });

  it("worst만 음수인 경우에도 모자람을 표시한다", () => {
    const items = [{ ...paycheck.items[0], amount: { min: 940000, max: 975000 } }];
    expect(calculateTimeline({ ...paycheck, items }).finalBalance)
      .toEqual({ best: 20000, worst: -15000, shortage: true });
  });

  it("같은 날짜는 입력 순서대로 두고 시기 미정은 맨 뒤에 둔다", () => {
    const salary = paycheck.events[0];
    const early = { ...salary, id: "early", date: "2026-11-21" };
    const same = { ...salary, id: "same" };
    expect(calculateTimeline({ ...paycheck, events: [grant, salary, same, early] }).groups
      .map(({ event }) => event.id)).toEqual(["early", "salary", "same", "grant"]);
  });

  it("확실한 입금만 선택하면 미정 입금과 연결 항목을 제외한다", () => {
    const items = [...paycheck.items, {
      ...paycheck.items[0], id: "extra", afterEventId: "grant", amount: { min: 30000, max: 50000 },
    }];
    const plan = { ...paycheck, events: [grant, ...paycheck.events], items };
    expect(calculateTimeline(plan, "confirmed").finalBalance).toMatchObject({ best: 140000, worst: 95000 });
    expect(calculateTimeline(plan, "all").finalBalance).toMatchObject({ best: 360000, worst: 195000 });
  });

  it("일별과 월별 반복에 범위 금액을 동일하게 적용한다", () => {
    const items = [
      { ...paycheck.items[0], amount: { min: 18000, max: 20000 }, repetition: { unit: "daily", count: 30 } as const },
      { ...paycheck.items[1], amount: { min: 200000, max: 200000 }, repetition: { unit: "monthly", count: 2 } as const },
    ];
    const timeline = calculateTimeline({ ...paycheck, items });
    expect(timeline.groups[0].items[0].amount).toEqual({ min: 540000, max: 600000 });
    expect(timeline.finalBalance).toEqual({ best: 20000, worst: -40000, shortage: true });
  });

  it("수정된 항목 순서와 순입금액을 반영한다", () => {
    const items = [{ ...paycheck.items[0], order: 10 }, paycheck.items[1]];
    const { groups } = calculateTimeline({ ...paycheck, items, taxMode: "withholding-3.3" });
    expect(groups[0].amount).toEqual({ min: 928320, max: 928320 });
    expect(groups[0].items.map(({ item }) => item.id)).toEqual(["guitar", "debt"]);
  });
});

describe("원 단위 입력과 세금", () => {
  it("7.5만원과 1원 단위 입력을 정수로 변환한다", () => {
    expect(parseManwon("7.5")).toBe(75000);
    expect(parseManwon(" 1,234.5678 ")).toBe(12345678);
    expect(parseManwon("0.0001")).toBe(1);
    expect(formatManwon(75000)).toBe("7.5");
    expect(formatManwon(960000)).toBe("96");
    expect(formatManwon(-15000)).toBe("-1.5");
  });

  it("뒤집힌 범위나 원 미만 입력을 거부한다", () => {
    expect(parseRange("7.5", "5")).toBeNull();
    expect(parseRange("7.5", "")).toEqual({ min: 75000, max: 75000 });
    expect(parseManwon("0.00001")).toBeNull();
    expect(parseManwon("1e3")).toBeNull();
    expect(parseManwon("999999999999999999")).toBeNull();
  });

  it("기본값은 원금을 유지하고 옵션에서 세금의 원 미만을 버린다", () => {
    const amount = { min: 1000, max: 1090 };
    expect(applyTax(amount, "none")).toEqual(amount);
    expect(parseTaxRate("3.33")).toBe(333);
    expect(parseTaxRate("100.01")).toBeNull();
    expect(applyTax(amount, "custom", 333)).toEqual({ min: 967, max: 1054 });
  });
});

describe("근무수당", () => {
  it("16일 × 6시간 × 1만원은 96만원이다", () => {
    expect(calculateWorkPay(16, parseWorkHours("6")!, 10000)).toBe(960000);
    expect(calculateWorkPay(1, parseWorkHours("1.25")!, 10001)).toBe(12501);
  });

  it("한국 공휴일과 주말을 제외하여 양쪽 날짜를 포함한다", () => {
    expect(countWorkdays("2026-05-01", "2026-05-06")).toEqual({ days: 2, missingYears: [] });
    expect(countWorkdays("2026-05-06", "2026-05-01")).toBeNull();
    expect(countWorkdays("2026-02-30", "2026-03-01")).toBeNull();
    expect(countWorkdays("2099-01-01", "2099-01-01")?.missingYears).toEqual([2099]);
  });
});

describe("비교와 메모", () => {
  it("항목을 이름과 종류로 맞추고 양쪽 잔액의 차이를 계산한다", () => {
    const left = calculateTimeline(paycheck);
    const right = calculateTimeline({
      ...paycheck,
      items: [{ ...paycheck.items[0], id: "renumbered", amount: { min: 30000, max: 30000 } }],
    });
    const rows = compareTimelines(left, right);
    expect(rows[0].difference).toEqual({ best: 90000n, worst: 90000n });
    expect(rows[1].right).toBeUndefined();
  });

  it("아이폰 메모 형식에서 각 줄에 잔액을 붙인다", () => {
    expect(formatMemo(calculateTimeline(paycheck))).toBe(
      "[1. 월급]\n* 회사 월급 96 → 잔액 96\n\n" +
      "[2. 1차 계획]\n* 12만원 갚기 → 잔액 84\n* 일렉 Yamaha Pacifica PAC112V 40 → 잔액 44\n" +
      "* AT2020 중고 5~7.5 → 잔액 39 ~ 36.5\n* 오인페 22 → 잔액 17 ~ 14.5\n" +
      "* 케이블 3~5 → 잔액 14 ~ 9.5",
    );
  });

  it("지원금 같은 입금은 메모에서 입금 섹션으로 표시한다", () => {
    const timeline = calculateTimeline({ ...paycheck, events: [...paycheck.events, grant] });
    expect(formatMemo(timeline)).toContain("[3. 입금]\n* 지원금 15~25 → 잔액 39 ~ 24.5");
  });
});
