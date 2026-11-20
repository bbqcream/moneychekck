import type { RangeAmount, TaxMode, Won } from "@/types/scenario";
import { checkedWon, parseScaled } from "./money";

export function parseTaxRate(input: string): number | null {
  const points = parseScaled(input, 2);
  return points !== null && points <= 10000 ? points : null;
}

export function applyTax(amount: RangeAmount, mode: TaxMode, customPoints = 0): RangeAmount {
  const points = mode === "none" ? 0 : mode === "withholding-3.3" ? 330 : customPoints;
  if (points === 0) return amount;
  const afterTax = (won: Won) => {
    const gross = BigInt(won);
    return checkedWon(gross - (gross * BigInt(points)) / 10000n);
  };
  return { min: afterTax(amount.min), max: afterTax(amount.max) };
}
