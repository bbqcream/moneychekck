import { useMemo, useState, type FormEvent } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Dialog } from "@/components/dialog";
import { formatManwon, parseManwon } from "@/lib/calc/money";
import { advicePercentages, analyzeSavings } from "@/lib/calc/savings-advice";
import { getCloudClient } from "@/lib/storage/supabase";
import { usePlans } from "@/store/provider";
import type { Scenario } from "@/types/scenario";
import { isRecord, readSavingsAdvice, type SavingsAdvice } from "../../../supabase/functions/savings-advice/contract";

const genericError = "AI 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
const errorMessages: Record<string, string> = {
  not_configured: "AI 연결을 사용하려면 서버에서 OpenAI API 키와 허용 계정을 설정해야 해요.",
  auth_required: "다시 로그인한 뒤 AI 제안을 요청해 주세요.",
  forbidden: "AI 사용이 설정된 계정으로 로그인해 주세요.",
  rate_limited: "AI 요청 한도에 도달했어요. 잠시 뒤 사용량을 확인해 주세요.",
  invalid_advice: "계산한 한도 안에서 AI가 제안을 만들지 못했어요. 다시 시도해 주세요.",
};

async function explainError(error: unknown) {
  if (!(error instanceof FunctionsHttpError)) return genericError;
  if (error.context.status === 404) return "AI 저축 제안 서버를 배포하면 사용할 수 있어요.";
  try {
    const payload: unknown = await error.context.json();
    if (isRecord(payload) && typeof payload.code === "string" && Object.hasOwn(errorMessages, payload.code)) {
      return errorMessages[payload.code];
    }
  } catch {
    return genericError;
  }
  return genericError;
}

export function SavingsAdviceDialog({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const online = usePlans((state) => state.syncPhase !== null);
  const [reserve, setReserve] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ inputKey: string; advice: SavingsAdvice }>();
  const reserveWon = reserve.trim() ? parseManwon(reserve) : 0;
  const { budget, confirmedCount, excludedCount } = useMemo(
    () => analyzeSavings(scenario, reserveWon ?? 0),
    [scenario, reserveWon],
  );
  const inputKey = JSON.stringify(budget);
  const advice = result?.inputKey === inputKey ? result.advice : undefined;
  const eligible = budget.incomeWon !== "0" && reserveWon !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || !online || busy) return;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const { data, error } = await getCloudClient().functions.invoke("savings-advice", { body: budget });
      if (error) {
        setError(await explainError(error));
        return;
      }
      const advice = readSavingsAdvice(data, budget.limitWon);
      if (advice) setResult({ inputKey, advice });
      else setError(errorMessages.invalid_advice);
    } catch {
      setError(genericError);
    } finally {
      setBusy(false);
    }
  }

  const totals = [
    { label: "확실한 입금", amount: budget.incomeWon },
    { label: "예정 지출·상환·송금", amount: budget.spendingWon },
    { label: "이미 계획한 저축", amount: budget.savingsWon },
    { label: "이미 계획한 투자", amount: budget.investmentWon },
  ];

  return (
    <Dialog title="저축 계획과 AI 제안" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <p className="meta">
          확실한 입금 {confirmedCount}건의 최소 금액과 예정된 차감의 최대 금액을 기준으로 계산해요.
          {excludedCount > 0 && " 미정 입금 " + excludedCount + "건은 제외했어요."}
        </p>
        <dl className="divide-y divide-line rounded-xl bg-canvas px-3 text-sm">
          {totals.map(({ label, amount }) => (
            <div className="flex flex-wrap justify-between gap-2 py-2" key={label}>
              <dt>{label}</dt><dd className="font-semibold">{formatManwon(BigInt(amount))}만원</dd>
            </div>
          ))}
        </dl>
        <label className="field">남겨둘 예비비 (만원)
          <input inputMode="decimal" value={reserve} placeholder="0" disabled={busy} onChange={(event) => setReserve(event.target.value)} />
        </label>
        {reserveWon === null && <p className="form-error" role="alert">예비비를 0 이상의 금액으로 입력해 주세요.</p>}
        <div className="rounded-xl bg-brand-soft p-3">
          <p className="text-sm font-semibold">추가 저축·투자 한도</p>
          <strong className="text-xl">{reserveWon === null ? "—" : formatManwon(budget.limitWon) + "만원"}</strong>
          {budget.hasShortfall && <p className="meta mt-1">입금과 항목의 진행 중에 부족한 구간이 있어요.</p>}
        </div>
        <p className="meta">
          {!online ? "Supabase 로그인이 연결된 앱에서 AI 제안을 받을 수 있어요."
            : budget.incomeWon === "0" ? "확실한 입금을 추가하면 AI 제안을 받을 수 있어요."
              : "요청 버튼을 누르면 위 금액 합계와 예비비를 OpenAI로 보내 제안을 받아요."}
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {advice && <AdviceResult advice={advice} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
          <button type="submit" className="btn btn-primary" disabled={!online || !eligible || busy}>
            {busy ? "AI 제안을 받고 있어요…" : "AI 저축 제안 받기"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AdviceResult({ advice }: { advice: SavingsAdvice }) {
  const percentages = advicePercentages(advice);
  return (
    <section className="panel form-stack p-3" aria-label="AI 저축 제안" aria-live="polite">
      <h3>AI 저축 제안</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt>추가 저축{percentages && " · " + percentages.savings + "%"}</dt>
          <dd className="font-semibold">{formatManwon(advice.savingsWon)}만원</dd>
        </div>
        <div>
          <dt>추가 투자{percentages && " · " + percentages.investment + "%"}</dt>
          <dd className="font-semibold">{formatManwon(advice.investmentWon)}만원</dd>
        </div>
      </dl>
      <p className="meta wrap-anywhere">{advice.reason}</p>
      <p className="meta wrap-anywhere">{advice.nextStep}</p>
    </section>
  );
}
