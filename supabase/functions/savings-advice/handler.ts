import { isRecord, readAdviceBudget, readSavingsAdvice } from "./contract.ts";

type Config = {
  supabaseUrl?: string;
  supabaseKey?: string;
  ownerId?: string;
  openAiKey?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const instructions = [
  "한국어로 가계 예산을 정리하는 도우미다. 사용자는 원 단위의 합계만 제공한다.",
  "확실한 입금의 최소액과 지출 및 기존 적립의 최대액, 남겨둔 예비비가 이미 계산에 반영되어 있다.",
  "savingsWon과 investmentWon은 추가로 배분할 원 단위 정수다. 두 값을 더해 limitWon을 넘기지 않는다.",
  "한도가 0이면 저축과 투자 모두 0을 제안한다. 상황을 모르면 비상금과 단기 지출을 먼저 고려한다.",
  "종목, 특정 금융상품, 은행, 수익률을 추천하지 않는다. 없는 수입이나 잔고를 추정하지 않는다.",
  "reason에는 짧은 이유, nextStep에는 한 가지 실천 단계를 적는다. 설명에 금액을 반복하지 않는다.",
].join(" ");

const adviceSchema = {
  type: "object",
  properties: {
    savingsWon: { type: "integer" },
    investmentWon: { type: "integer" },
    reason: { type: "string" },
    nextStep: { type: "string" },
  },
  required: ["savingsWon", "investmentWon", "reason", "nextStep"],
  additionalProperties: false,
};

function failure(status: number, code: string) {
  return Response.json({ code }, { status, headers: corsHeaders });
}

function responseText(value: unknown): string | undefined {
  if (!isRecord(value) || value.status !== "completed" || !Array.isArray(value.output)) return undefined;
  for (const item of value.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (isRecord(part) && part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
}

export function createSavingsAdviceHandler(config: Config, fetcher = fetch) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return failure(405, "method");
    const authorization = request.headers.get("Authorization");
    if (!authorization || !/^Bearer \S+$/.test(authorization)) return failure(401, "auth_required");
    const { supabaseUrl, supabaseKey, ownerId, openAiKey } = config;
    if (!supabaseUrl || !supabaseKey) return failure(503, "not_configured");

    try {
      const session = await fetcher(new URL("/auth/v1/user", supabaseUrl), {
        headers: { apikey: supabaseKey, Authorization: authorization },
        signal: AbortSignal.timeout(10000),
      });
      if (session.status === 401 || session.status === 403) return failure(401, "auth_required");
      if (!session.ok) return failure(502, "unavailable");
      const user: unknown = await session.json();
      if (!isRecord(user) || typeof user.id !== "string") return failure(401, "auth_required");
      if (!openAiKey || !ownerId) return failure(503, "not_configured");
      if (user.id !== ownerId) return failure(403, "forbidden");
    } catch {
      return failure(502, "unavailable");
    }

    let budget;
    try {
      const body = await request.text();
      budget = body.length <= 2048 ? readAdviceBudget(JSON.parse(body)) : null;
    } catch {
      return failure(400, "invalid_budget");
    }
    if (!budget || budget.incomeWon === "0") return failure(400, "invalid_budget");

    try {
      const upstream = await fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: "Bearer " + openAiKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          instructions,
          input: JSON.stringify(budget),
          store: false,
          max_output_tokens: 450,
          text: { format: { type: "json_schema", name: "savings_advice", strict: true, schema: adviceSchema } },
        }),
      });
      if (upstream.status === 429) return failure(429, "rate_limited");
      if (!upstream.ok) return failure(502, "unavailable");
      const text = responseText(await upstream.json());
      if (!text) return failure(502, "invalid_advice");
      const advice = readSavingsAdvice(JSON.parse(text), budget.limitWon);
      if (!advice) return failure(502, "invalid_advice");
      return Response.json(advice, { headers: corsHeaders });
    } catch {
      return failure(502, "unavailable");
    }
  };
}
