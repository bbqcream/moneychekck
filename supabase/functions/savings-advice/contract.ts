export type AdviceBudget = {
  incomeWon: string;
  spendingWon: string;
  savingsWon: string;
  investmentWon: string;
  reserveWon: number;
  limitWon: number;
  hasShortfall: boolean;
};

export type SavingsAdvice = { savingsWon: number; investmentWon: number; reason: string; nextStep: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isWon = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isTotal = (value: unknown): value is string =>
  typeof value === "string" && /^(?:0|[1-9]\d{0,29})$/.test(value);
const isDescription = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 400;

export function readAdviceBudget(value: unknown): AdviceBudget | null {
  if (!isRecord(value)) return null;
  const { incomeWon, spendingWon, savingsWon, investmentWon, reserveWon, limitWon, hasShortfall } = value;
  if (!isTotal(incomeWon) || !isTotal(spendingWon) || !isTotal(savingsWon) || !isTotal(investmentWon) ||
    !isWon(reserveWon) || !isWon(limitWon) || typeof hasShortfall !== "boolean") return null;
  if (hasShortfall && limitWon !== 0) return null;
  return { incomeWon, spendingWon, savingsWon, investmentWon, reserveWon, limitWon, hasShortfall };
}

export function readSavingsAdvice(value: unknown, limitWon: number): SavingsAdvice | null {
  if (!isRecord(value)) return null;
  const { savingsWon, investmentWon, reason, nextStep } = value;
  if (!isWon(savingsWon) || !isWon(investmentWon) || BigInt(savingsWon) + BigInt(investmentWon) > BigInt(limitWon) ||
    !isDescription(reason) || !isDescription(nextStep)) return null;
  return { savingsWon, investmentWon, reason, nextStep };
}
