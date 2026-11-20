import type { Item, RangeAmount } from "@/types/scenario";
import { checkedWon } from "./money";

export function totalItemAmount(item: Item): RangeAmount {
  if (!item.repetition) return item.amount;
  const count = BigInt(item.repetition.count);
  return {
    min: checkedWon(BigInt(item.amount.min) * count),
    max: checkedWon(BigInt(item.amount.max) * count),
  };
}
