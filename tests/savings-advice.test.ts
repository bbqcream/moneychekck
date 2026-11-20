import { describe, expect, it, vi } from "vitest";
import { advicePercentages, analyzeSavings } from "@/lib/calc/savings-advice";
import { readAdviceBudget, readSavingsAdvice } from "../supabase/functions/savings-advice/contract";
import { createSavingsAdviceHandler } from "../supabase/functions/savings-advice/handler";
import { paycheck } from "./fixtures/paycheck";

describe("저축 분석", () => {
  it("확실한 입금의 최소액과 최대 지출 목표를 계산해서 예비비를 남긴다", () => {
    const result = analyzeSavings({
      ...paycheck,
      events: [...paycheck.events, { ...paycheck.events[0], id: "grant", certainty: "uncertain" }],
      monthlySavings: [{
        id: "monthly", label: "적립",
        allocation: { savingsPercent: 80, savingsLabel: "비상", investmentLabel: "장기" },
        rates: [{ startMonth: "2026-11", amount: { min: 20000, max: 20000 } }],
      }],
    }, 50000);
    expect(result.confirmedCount).toBe(1);
    expect(result.excludedCount).toBe(1);
    expect(result.budget).toEqual({
      incomeWon: "960000", spendingWon: "865000", savingsWon: "16000", investmentWon: "4000",
      reserveWon: 50000, limitWon: 25000, hasShortfall: false,
    });
  });

  it("나중 입금으로 회복되더라도 중간에 잔액이 부족하면 추가 저축 한도는 0이다", () => {
    const first = { ...paycheck.events[0], amount: { min: 10000, max: 10000 } };
    const second = { ...paycheck.events[0], id: "later", date: null };
    const plan = { ...paycheck, events: [first, second], items: paycheck.items.slice(0, 1) };
    expect(analyzeSavings(plan, 0).budget).toMatchObject({ limitWon: 0, hasShortfall: true });
  });
});

describe("AI 저축 제안 형식", () => {
  it("금액 요약 외에 포함된 이름과 메모를 제거한다", () => {
    const { budget } = analyzeSavings(paycheck, 0);
    expect(readAdviceBudget({ ...budget, name: "시나리오 이름", note: "비공개 메모" })).toEqual(budget);
    expect(readAdviceBudget({ ...budget, incomeWon: "-100" })).toBeNull();
  });

  it("계산한 한도에 맞는 저축·투자만 결과로 받는다", () => {
    const advice = { savingsWon: 20000, investmentWon: 5000, reason: "비상금을 우선 확보해요.", nextStep: "다음 입금 후 지출을 확인하세요." };
    expect(readSavingsAdvice(advice, 25000)).toEqual(advice);
    expect(readSavingsAdvice(advice, 24999)).toBeNull();
    expect(readSavingsAdvice({ ...advice, savingsWon: -1 }, 25000)).toBeNull();
    expect(advicePercentages(advice)).toEqual({ savings: 80, investment: 20 });
    expect(advicePercentages({ ...advice, savingsWon: 0, investmentWon: 0 })).toBeUndefined();
  });
});

describe("AI 저축 함수", () => {
  const config = {
    supabaseUrl: "https://payplan-test.example.com", supabaseKey: "test-publishable",
    ownerId: "test-owner", openAiKey: "test-key",
  };
  const budget = analyzeSavings(paycheck, 0).budget;

  function request(authorization?: string) {
    return new Request("https://payplan-test.example.com/functions/v1/savings-advice", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : undefined,
      body: JSON.stringify({ ...budget, note: "서버 요약에서 제거할 메모" }),
    });
  }

  it("로그인하지 않았거나 허용 계정이 아니면 OpenAI를 호출하지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "different-user" }));
    const handle = createSavingsAdviceHandler(config, fetcher);
    expect((await handle(request())).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await handle(request("Bearer test-token"))).status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("/auth/v1/user");
  });

  it("서버에 API 키가 없으면 설정 오류를 반환한다", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: config.ownerId }));
    const handle = createSavingsAdviceHandler({ ...config, openAiKey: undefined }, fetcher);
    const response = await handle(request("Bearer test-token"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "not_configured" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["credit_balance_exhausted", "insufficient_quota", "credits_required"],
    ["rate_limit_exceeded", "requests", "rate_limited"],
  ])("OpenAI 응답 %s를 %s 유형에서 구분한다", async (code, type, expected) => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: config.ownerId }))
      .mockResolvedValueOnce(Response.json({ error: { code, type } }, { status: 429 }));
    const response = await createSavingsAdviceHandler(config, fetcher)(request("Bearer test-token"));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ code: expected });
  });

  it.each([20000, 100000])("OpenAI에 합계만 전달하고 한도를 벗어난 제안은 표시하지 않는다 (%i)", async (savingsWon) => {
    const advice = { savingsWon, investmentWon: 5000, reason: "예비비를 우선 고려해요.", nextStep: "지출을 다시 확인해요." };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: config.ownerId }))
      .mockResolvedValueOnce(Response.json({
        status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(advice) }] }],
      }));
    const handle = createSavingsAdviceHandler(config, fetcher);
    const response = await handle(request("Bearer test-token"));
    const outgoing = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(JSON.parse(outgoing.input)).toEqual(budget);
    expect(outgoing.store).toBe(false);
    expect(response.status).toBe(savingsWon === 20000 ? 200 : 502);
    expect(await response.json()).toEqual(savingsWon === 20000 ? advice : { code: "invalid_advice" });
  });
});
