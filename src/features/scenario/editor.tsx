"use client";

import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { MemoDialog } from "@/features/export/memo-dialog";
import { formatMemo } from "@/features/export/memo";
import { calculateTimeline, itemsForEvent, type TimelineOrder } from "@/lib/calc/balance";
import { eventPlanningMonth } from "@/lib/calc/monthly-overview";
import { usePlans } from "@/store/provider";
import type { Item, PayEvent, RangeAmount, Scenario } from "@/types/scenario";
import { EventDialog } from "./event-dialog";
import { ItemDialog } from "./item-dialog";
import { MonthlyRules } from "./monthly-rules";
import { MonthlySalaryCard } from "./monthly-salary-card";
import { NameDialog } from "./name-dialog";
import { PrioritySummary } from "./priority-summary";
import { SavingsAdviceDialog } from "./savings-advice-dialog";
import { TaxDialog, taxLabel } from "./tax-dialog";
import { TimelineView } from "./timeline-view";
import { WorkPayDialog } from "./work-pay-dialog";

type EditorDialog =
  | { type: "event"; event?: PayEvent; draftAmount?: RangeAmount }
  | { type: "item"; event: PayEvent; item?: Item }
  | { type: "delete-event"; event: PayEvent }
  | { type: "delete-item"; item: Item }
  | { type: "name" | "tax" | "work" | "memo" | "savings-advice" | "delete-plan" };

export function Editor({ scenario, month, mode, onDelete }: {
  scenario?: Scenario;
  month: string;
  mode: "base" | "detail";
  onDelete?: () => void;
}) {
  const updatePlan = usePlans((state) => state.updatePlan);
  const createPlan = usePlans((state) => state.createPlan);
  const moveToEvent = usePlans((state) => state.moveItemToEvent);
  const removePlan = usePlans((state) => state.removePlan);
  const [dialog, setDialog] = useState<EditorDialog | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [itemOrder, setItemOrder] = useState<TimelineOrder>("budget");
  const close = () => setDialog(null);
  const update = (change: (plan: Scenario) => Scenario) => {
    setError("");
    return scenario ? updatePlan(scenario.id, change) : "계획을 찾을 수 없어요.";
  };
  const timeline = scenario && calculateTimeline(scenario, "all", itemOrder);
  const displayedMonth = mode === "base" && !showAll ? month : undefined;
  const groups = (timeline?.groups ?? []).filter(({ event }) => !displayedMonth || (scenario && eventPlanningMonth(scenario, event) === displayedMonth));
  const visibleTimeline = timeline && { ...timeline, groups };
  const defaultMonth = mode === "detail" && scenario?.monthScope && scenario.monthScope !== "base" ? scenario.monthScope : month;
  const titleId = mode === "base" ? "month-spending-title" : "detail-timeline-title";

  function saveEvent(event: PayEvent) {
    if (!scenario) {
      createPlan("월별 기본 계획", { monthScope: "base", events: [{ ...event, plannedMonth: event.date ? undefined : defaultMonth }] });
      return null;
    }
    return update((plan) => {
      const previous = plan.events.find(({ id }) => id === event.id);
      const plannedMonth = event.date ? undefined : previous ? eventPlanningMonth(plan, previous) : defaultMonth;
      const saved = { ...event, plannedMonth };
      return {
        ...plan,
        events: previous ? plan.events.map((existing) => existing.id === event.id ? saved : existing) : [...plan.events, saved],
      };
    });
  }

  function saveItem(event: PayEvent, item: Omit<Item, "afterEventId" | "order">) {
    return update((plan) => {
      const existing = plan.items.find(({ id }) => id === item.id);
      if (existing) return { ...plan, items: plan.items.map((entry) => entry.id === item.id ? { ...existing, ...item } : entry) };
      const order = (itemsForEvent(plan.items, event.id).at(-1)?.order ?? -1) + 1;
      return { ...plan, items: [...plan.items, { ...item, afterEventId: event.id, order }] };
    });
  }

  function moveItem(item: Item, direction: -1 | 1) {
    const issue = update((plan) => {
      const sorted = itemsForEvent(plan.items, item.afterEventId);
      const from = sorted.findIndex(({ id }) => id === item.id);
      const target = from + direction;
      if (from < 0 || target < 0 || target >= sorted.length) return plan;
      [sorted[from], sorted[target]] = [sorted[target], sorted[from]];
      const orders = new Map(sorted.map(({ id }, order) => [id, order]));
      return { ...plan, items: plan.items.map((entry) => ({ ...entry, order: orders.get(entry.id) ?? entry.order })) };
    });
    if (issue) setError(issue);
  }

  return (
    <section className="timeline mt-4" aria-labelledby={titleId}>
      <div className="section-header flex-wrap">
        <h2 id={titleId}>{mode === "detail" ? scenario?.name : `${month} 입금과 항목`}</h2>
        <div className="button-row">
          {mode === "base" && scenario && <button type="button" className="btn btn-secondary" onClick={() => setShowAll(!showAll)}>{showAll ? "선택한 달 보기" : "전체 기간 보기"}</button>}
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ type: "event" })}>+ 입금 추가</button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {groups.some(({ items }) => items.some(({ monthlyRuleId }) => !monthlyRuleId)) && (
        <label className="field mb-3 max-w-64">항목 정렬
          <select value={itemOrder} onChange={(event) => setItemOrder(event.target.value === "input" ? "input" : "budget")}>
            <option value="budget">예산순 · 감당 가능한 항목 우선</option>
            <option value="input">입력 순서</option>
          </select>
        </label>
      )}
      {scenario && groups.length ? (
        <TimelineView groups={groups} onMove={(item, eventId) => moveToEvent(scenario.id, item.id, eventId)} edits={{
          addItem: (event) => setDialog({ type: "item", event }),
          editEvent: (event) => setDialog({ type: "event", event }),
          deleteEvent: (event) => setDialog({ type: "delete-event", event }),
          editItem: (event, item) => setDialog({ type: "item", event, item }),
          deleteItem: (item) => setDialog({ type: "delete-item", item }),
          moveItem: itemOrder === "input" ? moveItem : undefined,
        }} />
      ) : (
        <div className="empty-panel">
          <h3>{displayedMonth ? "이달에 입금이 없어요" : "첫 입금을 추가해 보세요"}</h3>
          <p>입금을 추가하면 그 아래에 지출과 저축을 적을 수 있어요.</p>
        </div>
      )}
      {scenario && visibleTimeline && <details className="panel mt-3 px-3 py-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">계획 도구</summary>
        <div className="mb-3 button-row">
          <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "tax" })}>세금 설정 · {taxLabel(scenario)}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "work" })}>근무수당 계산기</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "savings-advice" })}>{displayedMonth && "전체 기간 "}저축 계획과 AI</button>
          <button type="button" className="btn btn-secondary" disabled={!groups.length} onClick={() => setDialog({ type: "memo" })}>아이폰 메모 내보내기</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "name" })}>이름 수정</button>
          <button type="button" className="btn btn-quiet danger-text" onClick={() => setDialog({ type: "delete-plan" })}>{mode === "base" ? "기본 계획 삭제" : "시나리오 삭제"}</button>
        </div>
        <div className="grid gap-2">
          <PrioritySummary timeline={visibleTimeline} />
          {mode === "detail" && <>
            <MonthlySalaryCard scenario={scenario} collapsible />
            <MonthlyRules scenario={scenario} kind="expense" collapsible />
            <MonthlyRules scenario={scenario} kind="saving" collapsible />
          </>}
        </div>
      </details>}
      {scenario && dialog?.type === "name" && <NameDialog title="시나리오 이름 수정" name={scenario.name} onSave={(name) => update((plan) => ({ ...plan, name }))} onClose={close} />}
      {dialog?.type === "event" && <EventDialog event={dialog.event} draftAmount={dialog.draftAmount} draftDate={defaultMonth + "-01"} onSave={saveEvent} onClose={close} />}
      {dialog?.type === "item" && <ItemDialog item={dialog.item} eventLabel={dialog.event.label} onSave={(item) => saveItem(dialog.event, item)} onClose={close} />}
      {dialog?.type === "work" && <WorkPayDialog onUse={(won) => setDialog({ type: "event", draftAmount: { min: won, max: won } })} onClose={close} />}
      {scenario && dialog?.type === "tax" && <TaxDialog scenario={scenario} onSave={(taxMode, customTaxBasisPoints) => update((plan) => ({ ...plan, taxMode, customTaxBasisPoints }))} onClose={close} />}
      {visibleTimeline && dialog?.type === "memo" && <MemoDialog text={formatMemo(visibleTimeline)} onClose={close} />}
      {scenario && dialog?.type === "savings-advice" && <SavingsAdviceDialog scenario={scenario} onClose={close} />}
      {dialog?.type === "delete-event" && (
        <ConfirmAction title="입금을 삭제할까요?" description={"‘" + dialog.event.label + "’와 연결된 항목도 함께 삭제돼요."} actionLabel="입금 삭제" onClose={close}
          onConfirm={() => update((plan) => ({
            ...plan, events: plan.events.filter(({ id }) => id !== dialog.event.id),
            items: plan.items.filter(({ afterEventId }) => afterEventId !== dialog.event.id),
          })) ?? undefined} />
      )}
      {dialog?.type === "delete-item" && (
        <ConfirmAction title="항목을 삭제할까요?" description={"‘" + dialog.item.label + "’를 삭제하면 이후 잔액이 다시 계산돼요."} actionLabel="항목 삭제" onClose={close}
          onConfirm={() => update((plan) => ({ ...plan, items: plan.items.filter(({ id }) => id !== dialog.item.id) })) ?? undefined} />
      )}
      {scenario && dialog?.type === "delete-plan" && (
        <ConfirmAction title="시나리오를 삭제할까요?" description={"‘" + scenario.name + "’의 입금과 항목이 모두 삭제돼요."} actionLabel="시나리오 삭제" onClose={close}
          onConfirm={() => {
            removePlan(scenario.id);
            onDelete?.();
          }} />
      )}
    </section>
  );
}
