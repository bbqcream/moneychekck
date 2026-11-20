import type { RangeAmount, Won } from "@/types/scenario";

export function parseScaled(input: string, places: number): number | null {
  const value = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value) || value.length > 32) return null;
  const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
  if (fraction.length > places) return null;
  const integer = Number(whole + fraction.padEnd(places, "0"));
  return Number.isSafeInteger(integer) ? integer : null;
}

export function checkedWon(value: bigint): Won {
  const won = Number(value);
  if (!Number.isSafeInteger(won)) throw new RangeError("금액이 계산 가능한 범위를 넘었어요.");
  return won;
}

export function parseManwon(input: string): Won | null {
  return parseScaled(input, 4);
}

export function parseRange(minInput: string, maxInput: string): RangeAmount | null {
  const min = parseManwon(minInput);
  const max = maxInput.trim() ? parseManwon(maxInput) : min;
  return min !== null && max !== null && min <= max ? { min, max } : null;
}

export function toManwonInput(won: Won): string {
  const digits = BigInt(won).toString().padStart(5, "0");
  const fraction = digits.slice(-4).replace(/0+$/, "");
  return digits.slice(0, -4) + (fraction ? "." + fraction : "");
}

export function formatManwon(won: Won | bigint, signed = false): string {
  const integer = BigInt(won);
  const magnitude = integer < 0n ? -integer : integer;
  const tenths = (magnitude + 500n) / 1000n;
  const prefix = integer < 0n ? "-" : signed && integer > 0n ? "+" : "";
  if (magnitude > 0n && tenths === 0n) return prefix + "<0.1";
  const whole = (tenths / 10n).toLocaleString("ko-KR");
  const fraction = tenths % 10n;
  return prefix + whole + (fraction ? "." + fraction : "");
}

export function formatRange(amount: { min: Won | bigint; max: Won | bigint }): string {
  return amount.min === amount.max
    ? formatManwon(amount.min)
    : formatManwon(amount.min) + "~" + formatManwon(amount.max);
}
