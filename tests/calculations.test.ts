import { describe, expect, it } from "vitest";
import { calculateTimeline } from "@/lib/calc/balance";
import { splitSavingsAmount } from "@/lib/calc/monthly";
import { eventPlanningMonth, stepMonth, summarizeMonth } from "@/lib/calc/monthly-overview";
import { getMonthlyWorkspace } from "@/features/scenario/monthly-workspace";
import { summarizePriorities } from "@/lib/calc/priorities";
import { compareTimelines } from "@/lib/calc/compare";
import { formatManwon, parseManwon, parseRange } from "@/lib/calc/money";
import { applyTax, parseTaxRate } from "@/lib/calc/tax";
import { calculateHourlySalary, calculateWorkPay, countWorkdays, parseWorkHours } from "@/lib/calc/work-pay";
import { formatMemo } from "@/features/export/memo";
import { analyzeSavings } from "@/lib/calc/savings-advice";
import type { PayEvent } from "@/types/scenario";
import { paycheck } from "./fixtures/paycheck";

const grant: PayEvent = {
  id: "grant",
  label: "지원금",
  amount: { min: 150000, max: 250000 },
  date: null,
  certainty: "uncertain",
};

describe("월별 보기", () => {
  it("날짜 미정 입금은 보관한 월에서 찾을 수 있고 월말 합계에는 들어가지 않는다", () => {
    const pending = { ...grant, plannedMonth: "2027-01" };
    const scenario = { ...paycheck, events: [...paycheck.events, pending] };
    expect(eventPlanningMonth(scenario, pending)).toBe("2027-01");
    expect(eventPlanningMonth(scenario, grant)).toBe(paycheck.createdAt.slice(0, 7));
    expect(summarizeMonth(calculateTimeline(scenario), "2027-01").income.max).toBe(0n);
  });
  it("기본 계획과 선택한 달의 세부 시나리오를 구분하고 기존 계획도 날짜로 찾는다", () => {
    const base = { ...paycheck, id: "base", monthScope: "base" };
    const november = { ...paycheck, id: "november", monthScope: "2026-11" };
    const december = { ...paycheck, id: "december", monthScope: "2026-12", events: [], items: [] };
    const legacy = { ...paycheck, id: "legacy" };
    const plans = [december, november, legacy, base];
    expect(getMonthlyWorkspace(plans, "2026-11").details.map(({ scenario }) => scenario.id)).toEqual(["november", "legacy"]);
    expect(getMonthlyWorkspace(plans, "2026-12").details.map(({ scenario }) => scenario.id)).toEqual(["december"]);
    expect(getMonthlyWorkspace(plans, "2026-12").base?.id).toBe("base");
    expect(getMonthlyWorkspace([december, legacy], "2026-12").base?.id).toBe("legacy");
  });

  it("앞 달 잔액을 이월하고 선택월의 입금, 지출, 저축·투자만 합산한다", () => {
    const timeline = calculateTimeline({
      ...paycheck, events: [...paycheck.events, grant],
      monthlySalary: { label: "월급", amount: 960000, day: 10, startMonth: "2026-12", endMonth: "2026-12" },
      monthlyExpenses: [{ id: "transport", label: "교통비", rates: [{ startMonth: "2026-12", amount: { min: 40000, max: 40000 } }] }],
      monthlySavings: [{
        id: "savings", label: "저축·투자", allocation: { savingsPercent: 80, savingsLabel: "비상금", investmentLabel: "장기 투자" },
        rates: [{ startMonth: "2026-12", amount: { min: 50000, max: 100000 } }],
      }],
    });
    expect(summarizeMonth(timeline, "2026-12")).toMatchObject({
      income: { min: 960000n, max: 960000n }, spending: { min: 40000n, max: 40000n },
      savings: { min: 50000n, max: 100000n }, closing: { best: 1010000, worst: 915000 }, count: 1,
    });
    expect(summarizeMonth(timeline, "2027-01")).toMatchObject({
      count: 0, income: { min: 0n, max: 0n }, closing: { best: 1010000, worst: 915000 },
    });
  });

  it("이전 달과 다음 달로 이동할 때 연도가 바뀐다", () => {
    expect(stepMonth("2026-12", 1)).toBe("2027-01");
    expect(stepMonth("2027-01", -1)).toBe("2026-12");
  });
});

describe("잔액 타임라인", () => {
  it("월급 비율 저축은 다른 입금과 무관하게 해당 달의 세후 고정 월급에서 차감한다", () => {
    const scenario = {
      ...paycheck, items: [], events: [{ ...paycheck.events[0], date: "2027-01-05" }, { ...grant, date: "2027-03-10" }],
      taxMode: "withholding-3.3" as const,
      monthlySalary: {
        label: "회사 월급", amount: 1320000, day: 10, startMonth: "2027-01", endMonth: "2027-02",
        hourly: { schedule: "previous-month" as const, hourHundredths: 600, hourlyWon: 10000 },
      },
      monthlySavings: [{
        id: "salary-saving", label: "월급 적립", rates: [{ startMonth: "2027-01", salaryPercent: 25 }],
        allocation: { savingsPercent: 80, savingsLabel: "비상금", investmentLabel: "장기 투자" },
      }],
    };
    const { groups } = calculateTimeline(scenario);
    expect(groups.map(({ items }) => items.map(({ amount }) => amount.min))).toEqual([[], [255288, 63822], [232080, 58020], []]);
    expect(groups[1].items.at(-1)?.balance.worst).toBe(groups[1].balance.worst - 319110);
  });

  it("월급을 지정한 달마다 확실한 입금으로 반영하고 짧은 달에는 말일에 넣는다", () => {
    const scenario = {
      ...paycheck, events: [grant], items: [],
      monthlySalary: { label: "회사 월급", amount: 960000, day: 31, startMonth: "2027-12", endMonth: "2028-03" },
      monthlyExpenses: [{ id: "transport", label: "교통비", rates: [{ startMonth: "2027-12", amount: { min: 60000, max: 60000 } }] }],
    };
    const { groups, finalBalance } = calculateTimeline(scenario, "confirmed");
    expect(groups.map(({ event }) => event.date)).toEqual(["2027-12-31", "2028-01-31", "2028-02-29", "2028-03-31"]);
    expect(groups.map(({ items }) => items[0].balance.worst)).toEqual([900000, 1800000, 2700000, 3600000]);
    expect(finalBalance.worst).toBe(3600000);
    expect(analyzeSavings(scenario, 0)).toMatchObject({ confirmedCount: 4, excludedCount: 1 });
  });

  it("월급 날짜와 금액을 바꿔도 같은 달 입금에 연결한 항목은 유지한다", () => {
    const monthlySalary = { label: "월급", amount: 100000, day: 25, startMonth: "2026-12", endMonth: "2026-12" };
    const scenario = { ...paycheck, events: [], items: [], monthlySalary };
    const [{ event }] = calculateTimeline(scenario).groups;
    const items = [{ ...paycheck.items[0], afterEventId: event.id, amount: { min: 50000, max: 50000 } }];
    const changed = calculateTimeline({ ...scenario, items, monthlySalary: { ...monthlySalary, amount: 200000, day: 10 } });
    expect(changed.groups[0].event.date).toBe("2026-12-10");
    expect(changed.groups[0].items[0].item).toEqual(items[0]);
    expect(changed.finalBalance.worst).toBe(150000);
  });

  it("월 고정저축을 저축과 투자로 나누고 한 달에 한 번만 반영한다", () => {
    const first = paycheck.events[0];
    const second = { ...first, id: "bonus", date: "2026-11-30" };
    const scenario = {
      ...paycheck, items: [], events: [second, first],
      monthlySavings: [{
        id: "long-term", label: "매달 모으기", priority: "P2" as const,
        allocation: { savingsPercent: 80, savingsLabel: "비상금", investmentLabel: "장기 투자" },
        rates: [{ startMonth: "2026-11", amount: { min: 100000, max: 100000 } }],
      }],
    };
    const { groups } = calculateTimeline(scenario);
    expect(groups[0].items.map(({ item, amount, balance }) => [item.kind, item.label, amount.min, balance.best])).toEqual([
      ["saving", "비상금", 80000, 880000],
      ["investment", "장기 투자", 20000, 860000],
    ]);
    expect(groups[1].items).toEqual([]);
  });

  it("저축 비율을 원 단위로 절사하고 나머지를 투자에 배정한다", () => {
    const amount = { min: 100001, max: 100004 };
    expect(splitSavingsAmount(amount, 80)).toEqual({
      savings: { min: 80000, max: 80003 }, investment: { min: 20001, max: 20001 },
    });
    expect(splitSavingsAmount(amount, 100)).toEqual({ savings: amount, investment: { min: 0, max: 0 } });
    expect(splitSavingsAmount(amount, 0)).toEqual({ savings: { min: 0, max: 0 }, investment: amount });
  });

  it("우선순위별 합계에 실제 반영된 월 고정지출과 반복 항목을 포함한다", () => {
    const scenario = {
      ...paycheck,
      monthlyExpenses: [{
        id: "transportation", label: "교통비", priority: "P1" as const,
        rates: [{ startMonth: "2026-11", amount: { min: 40000, max: 40000 } }],
      }],
      items: [
        { ...paycheck.items[0], priority: "P1" as const },
        { ...paycheck.items[2], priority: "P2" as const, repetition: { unit: "monthly" as const, count: 2 } },
        paycheck.items[4],
      ],
    };
    const timeline = calculateTimeline(scenario);
    expect(summarizePriorities(timeline)).toEqual({
      P1: { min: 160000n, max: 160000n, count: 2 },
      P2: { min: 100000n, max: 150000n, count: 1 },
      P3: { min: 0n, max: 0n, count: 0 },
      unassigned: { min: 30000n, max: 50000n, count: 1 },
    });
    expect(timeline.finalBalance).toEqual(calculateTimeline({
      ...scenario, items: scenario.items.map((item) => ({ ...item, priority: undefined })),
    }).finalBalance);
    expect(formatMemo(timeline)).toContain("* [P1] 교통비 4 → 잔액 92");
  });

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

  it("월 고정지출은 같은 달에 한 번만 차감하고 변경 월부터 새 금액을 적용한다", () => {
    const first = { ...paycheck.events[0], date: "2026-12-10" };
    const second = { ...first, id: "second", date: "2026-12-24" };
    const third = { ...first, id: "third", date: "2027-01-10" };
    const plan = {
      ...paycheck, items: [], events: [grant, second, third, first],
      monthlyExpenses: [{
        id: "transportation", label: "교통비", rates: [
          { startMonth: "2026-11", amount: { min: 40000, max: 40000 } },
          { startMonth: "2027-01", amount: { min: 60000, max: 60000 } },
        ],
      }],
    };
    const { groups } = calculateTimeline(plan);
    expect(groups.map(({ items }) => items.map(({ amount }) => amount.min))).toEqual([[40000], [], [60000], []]);
    expect(groups[0].items[0].balance.worst).toBe(920000);
    expect(groups[2].items[0].balance.worst).toBe(2780000);
  });

  it("미정 입금이 앞서도 월 고정지출은 해당 월의 첫 확실한 입금에 배정한다", () => {
    const first = { ...grant, date: "2026-11-10" };
    const plan = {
      ...paycheck, events: [first, ...paycheck.events], items: [],
      monthlyExpenses: [{ id: "transportation", label: "교통비", rates: [{ startMonth: "2026-11", amount: { min: 40000, max: 40000 } }] }],
    };
    expect(calculateTimeline(plan).groups.map(({ items }) => items.length)).toEqual([0, 1]);
    expect(calculateTimeline(plan, "confirmed").groups[0].items).toHaveLength(1);
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
  it("시급 월급은 수동 근무일수와 소수 시간으로 원 단위까지 계산한다", () => {
    const hourly = { schedule: "manual", days: 16, hourHundredths: 600, hourlyWon: 10000 } as const;
    expect(calculateHourlySalary(hourly, "2026-12")).toMatchObject({ amount: 960000, days: 16 });
    expect(calculateHourlySalary({ ...hourly, days: 21, hourHundredths: 625, hourlyWon: 10123 }, "2026-12")?.amount).toBe(1328643);
    for (const invalid of [{ days: 0 }, { days: 32 }, { hourHundredths: 2401 }, { hourlyWon: Number.MAX_SAFE_INTEGER }]) {
      expect(calculateHourlySalary({ ...hourly, ...invalid }, "2026-12")).toBeNull();
    }
  });

  it("전월 근무를 기준으로 월급을 계산하며 공휴일과 연도 변경을 반영한다", () => {
    const hourly = { schedule: "previous-month", hourHundredths: 600, hourlyWon: 10000 } as const;
    const first = calculateHourlySalary(hourly, "2027-01");
    expect(first).toMatchObject({ days: 22, amount: 1320000, workMonth: "2026-12" });
    expect(calculateHourlySalary(hourly, "2027-02")).toMatchObject({ days: 20, amount: 1200000, workMonth: "2027-01" });
    expect(calculateHourlySalary({ ...hourly, schedule: "current-month" }, "2099-01")?.missingHolidays).toBe(true);
    const { groups } = calculateTimeline({
      ...paycheck, events: [], items: [],
      monthlySalary: { label: "월급", amount: 1320000, day: 10, startMonth: "2027-01", endMonth: "2027-02", hourly },
    });
    expect(groups.map(({ event, amount }) => [event.date, amount.min])).toEqual([
      ["2027-01-10", 1320000], ["2027-02-10", 1200000],
    ]);
  });

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
