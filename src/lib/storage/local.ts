import { calculateTimeline } from "@/lib/calc/balance";
import { isMonth } from "@/lib/calc/monthly";
import { parseCalendarDate } from "@/lib/calc/work-pay";
import type { CurrentBalance, PlanData } from "@/types/plan-data";
import { isSpendingPriority, itemKinds, type Item, type MonthlyRate, type MonthlyRule, type MonthlySaving, type PayEvent, type RangeAmount, type Scenario } from "@/types/scenario";

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
    !isUnsignedInteger(value.order) || (value.note !== undefined && typeof value.note !== "string") ||
    (value.priority !== undefined && !isSpendingPriority(value.priority))) return false;
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

function isMonthlyRule(value: unknown): value is MonthlyRule {
  return isRecord(value) && isText(value.id) && isText(value.label) && Array.isArray(value.rates) &&
    (value.priority === undefined || isSpendingPriority(value.priority)) &&
    value.rates.length > 0 && value.rates.every(isMonthlyRate) &&
    new Set(value.rates.map(({ startMonth }) => startMonth)).size === value.rates.length;
}

function isMonthlySaving(value: unknown): value is MonthlySaving {
  if (!isRecord(value)) return false;
  const allocation = value.allocation;
  return isMonthlyRule(value) && isRecord(allocation) && isUnsignedInteger(allocation.savingsPercent) && allocation.savingsPercent <= 100 &&
    isText(allocation.savingsLabel) && isText(allocation.investmentLabel);
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
  const expenses = value.monthlyExpenses;
  if (expenses !== undefined &&
    (!Array.isArray(expenses) || !expenses.every(isMonthlyRule) || !hasUniqueIds(expenses))) return false;
  const savings = value.monthlySavings;
  if (savings !== undefined &&
    (!Array.isArray(savings) || !savings.every(isMonthlySaving) || !hasUniqueIds(savings))) return false;
  const eventIds = new Set(value.events.map(({ id }) => id));
  return eventIds.size === value.events.length && hasUniqueIds(value.items) &&
    value.items.every((item) => eventIds.has(item.afterEventId));
}

function isCurrentBalance(value: unknown): value is CurrentBalance {
  return isRecord(value) && isUnsignedInteger(value.amount) &&
    typeof value.recordedAt === "string" && Number.isFinite(Date.parse(value.recordedAt));
}

export const planDocument = (data: PlanData) => ({ version: 1, ...data });
export const serializePlanData = (data: PlanData) => JSON.stringify(planDocument(data), null, 2);

export function validateBalances(scenario: Scenario) {
  calculateTimeline(scenario);
  calculateTimeline(scenario, "confirmed");
}

export function decodePlanData(value: unknown): PlanData {
  if (!isRecord(value) || !Array.isArray(value.scenarios) ||
    !value.scenarios.every(isScenario) || !hasUniqueIds(value.scenarios) ||
    (value.currentBalance !== undefined && !isCurrentBalance(value.currentBalance))) throw new Error("Invalid plan data");
  value.scenarios.forEach(validateBalances);
  return { scenarios: value.scenarios, currentBalance: value.currentBalance };
}

export function decodePlanDocument(value: unknown): PlanData {
  if (!isRecord(value) || value.version !== 1) throw new Error("Invalid plan version");
  return decodePlanData(value);
}

export const parsePlanDocument = (text: string): PlanData => decodePlanDocument(JSON.parse(text));

export function loadPlanData(): PlanData {
  const stored = localStorage.getItem(storageKey);
  return stored === null ? { scenarios: [] } : parsePlanDocument(stored);
}

export function savePlanData(data: PlanData) {
  localStorage.setItem(storageKey, serializePlanData(data));
}

export function clearPlans() {
  localStorage.removeItem(storageKey);
}
