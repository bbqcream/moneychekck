import { calculateTimeline } from "@/lib/calc/balance";
import { isMonth } from "@/lib/calc/monthly";
import { parseCalendarDate } from "@/lib/calc/work-pay";
import { itemKinds, type Item, type MonthlyExpense, type MonthlyRate, type PayEvent, type RangeAmount, type Scenario } from "@/types/scenario";

const storageKey = "payplan:v1";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const isUnsignedInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function isAmount(value: unknown): value is RangeAmount {
  return isRecord(value) && isUnsignedInteger(value.min) && isUnsignedInteger(value.max) && value.min <= value.max;
}

function isEvent(value: unknown): value is PayEvent {
  return isRecord(value) && isText(value.id) && isText(value.label) && isAmount(value.amount) &&
    (value.date === null || (typeof value.date === "string" && parseCalendarDate(value.date) !== null)) &&
    (value.certainty === "confirmed" || value.certainty === "uncertain") &&
    (value.note === undefined || typeof value.note === "string");
}

function isItem(value: unknown): value is Item {
  if (!isRecord(value) || !isText(value.id) || !isText(value.label) || !isAmount(value.amount) ||
    !itemKinds.some((kind) => kind === value.kind) || !isText(value.afterEventId) ||
    !isUnsignedInteger(value.order) || (value.note !== undefined && typeof value.note !== "string")) return false;
  const repeat = value.repetition;
  return repeat === undefined || (isRecord(repeat) && (repeat.unit === "daily" || repeat.unit === "monthly") &&
    isUnsignedInteger(repeat.count) && repeat.count > 0);
}

function hasUniqueIds(values: { id: string }[]) {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

function isMonthlyRate(value: unknown): value is MonthlyRate {
  return isRecord(value) && typeof value.startMonth === "string" && isMonth(value.startMonth) && isAmount(value.amount);
}

function isMonthlyExpense(value: unknown): value is MonthlyExpense {
  return isRecord(value) && isText(value.id) && isText(value.label) && Array.isArray(value.rates) &&
    value.rates.length > 0 && value.rates.every(isMonthlyRate) &&
    new Set(value.rates.map(({ startMonth }) => startMonth)).size === value.rates.length;
}

function isScenario(value: unknown): value is Scenario {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[a-z\d_-]+$/i.test(value.id) || !isText(value.name) ||
    !isText(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) ||
    !isText(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.events) || !value.events.every(isEvent) ||
    !Array.isArray(value.items) || !value.items.every(isItem)) return false;
  if (value.taxMode !== "none" && value.taxMode !== "withholding-3.3" && value.taxMode !== "custom") return false;
  const rate = value.customTaxBasisPoints;
  if (rate !== undefined && (!isUnsignedInteger(rate) || rate > 10000)) return false;
  if (value.taxMode === "custom" && rate === undefined) return false;
  const monthly = value.monthlyExpenses;
  if (monthly !== undefined &&
    (!Array.isArray(monthly) || !monthly.every(isMonthlyExpense) || !hasUniqueIds(monthly))) return false;
  const eventIds = new Set(value.events.map(({ id }) => id));
  return eventIds.size === value.events.length && hasUniqueIds(value.items) &&
    value.items.every((item) => eventIds.has(item.afterEventId));
}

export function planDocument(scenarios: Scenario[]) {
  return { version: 1, scenarios };
}

export const serializePlans = (scenarios: Scenario[]) => JSON.stringify(planDocument(scenarios), null, 2);

export function validateBalances(scenario: Scenario) {
  calculateTimeline(scenario);
  calculateTimeline(scenario, "confirmed");
}

export function decodePlans(value: unknown): Scenario[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.scenarios) ||
    !value.scenarios.every(isScenario) || !hasUniqueIds(value.scenarios)) throw new Error("Invalid plan data");
  value.scenarios.forEach(validateBalances);
  return value.scenarios;
}

export const parsePlans = (text: string): Scenario[] => decodePlans(JSON.parse(text));

export function loadPlans(): Scenario[] {
  const stored = localStorage.getItem(storageKey);
  return stored === null ? [] : parsePlans(stored);
}

export function savePlans(scenarios: Scenario[]) {
  localStorage.setItem(storageKey, serializePlans(scenarios));
}

export function clearPlans() {
  localStorage.removeItem(storageKey);
}
