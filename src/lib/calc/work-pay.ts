import * as holidays from "@hyunbinseo/holidays-kr/all";
import type { Won } from "@/types/scenario";
import { checkedWon, parseScaled } from "./money";

const dayMs = 86400000;
const holidayDates = Object.values(holidays).flatMap((year) => Object.keys(year));
const holidayYears = new Set(Object.keys(holidays).map((key) => Number(key.slice(1))));

export function parseCalendarDate(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || input.startsWith("0000")) return null;
  const date = new Date(input + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === input ? date : null;
}

export function countWorkdays(start: string, end: string) {
  const from = parseCalendarDate(start);
  const to = parseCalendarDate(end);
  if (!from || !to || from > to) return null;

  const total = (to.getTime() - from.getTime()) / dayMs + 1;
  let days = Math.floor(total / 7) * 5;
  for (let offset = 0; offset < total % 7; offset++) {
    const weekday = (from.getUTCDay() + offset) % 7;
    if (weekday > 0 && weekday < 6) days++;
  }
  for (const holiday of holidayDates) {
    if (holiday < start || holiday > end) continue;
    const weekday = parseCalendarDate(holiday)?.getUTCDay();
    if (weekday && weekday < 6) days--;
  }
  const missingYears = [];
  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year++) {
    if (!holidayYears.has(year)) missingYears.push(year);
  }
  return { days, missingYears };
}

export function parseWorkHours(input: string): number | null {
  const hundredths = parseScaled(input, 2);
  return hundredths !== null && hundredths <= 2400 ? hundredths : null;
}

export function calculateWorkPay(days: number, hourHundredths: number, hourlyWon: Won): Won {
  return checkedWon((BigInt(days) * BigInt(hourHundredths) * BigInt(hourlyWon)) / 100n);
}
