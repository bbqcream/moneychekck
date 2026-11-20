import type { Balance, Timeline } from "./balance";

export function stepMonth(month: string, direction: -1 | 1) {
  const date = new Date(month + "-01T00:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + direction);
  const year = date.getUTCFullYear();
  return year < 1 || year > 9999 ? month : date.toISOString().slice(0, 7);
}

export function summarizeMonth(timeline: Timeline, month: string) {
  const income = { min: 0n, max: 0n };
  const spending = { min: 0n, max: 0n };
  const savings = { min: 0n, max: 0n };
  let closing: Balance | undefined;
  let count = 0;
  for (const group of timeline.groups) {
    const eventMonth = group.event.date?.slice(0, 7);
    if (!eventMonth || eventMonth > month) break;
    closing = group.items.at(-1)?.balance ?? group.balance;
    if (eventMonth !== month) continue;
    count++;
    income.min += BigInt(group.amount.min);
    income.max += BigInt(group.amount.max);
    for (const { item, amount } of group.items) {
      const total = item.kind === "saving" || item.kind === "investment" ? savings : spending;
      total.min += BigInt(amount.min);
      total.max += BigInt(amount.max);
    }
  }
  return { income, spending, savings, closing, count };
}
