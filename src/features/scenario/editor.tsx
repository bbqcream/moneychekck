"use client";

import { useState } from "react";
import { BalanceText } from "@/components/balance-text";
import { ConfirmAction } from "@/components/confirm-action";
import { MemoDialog } from "@/features/export/memo-dialog";
import { formatMemo } from "@/features/export/memo";
import { calculateTimeline, itemsForEvent } from "@/lib/calc/balance";
import { usePlans } from "@/store/provider";
import type { Item, PayEvent, RangeAmount, Scenario } from "@/types/scenario";
import { CurrentBalanceCard } from "./current-balance-card";
import { EventDialog } from "./event-dialog";
import { ItemDialog } from "./item-dialog";
import { MonthlyExpenses } from "./monthly-expenses";
import { NameDialog } from "./name-dialog";
import { PrioritySummary } from "./priority-summary";
import { TaxDialog, taxLabel } from "./tax-dialog";
import { TimelineView } from "./timeline-view";
import { WorkPayDialog } from "./work-pay-dialog";

type EditorDialog =
  | { type: "event"; event?: PayEvent; draftAmount?: RangeAmount }
  | { type: "item"; event: PayEvent; item?: Item }
  | { type: "delete-event"; event: PayEvent }
  | { type: "delete-item"; item: Item }
  | { type: "name" | "tax" | "work" | "memo" | "delete-plan" };

export function Editor({ scenario }: { scenario: Scenario }) {
  const updatePlan = usePlans((state) => state.updatePlan);
  const removePlan = usePlans((state) => state.removePlan);
  const [dialog, setDialog] = useState<EditorDialog | null>(null);
  const [error, setError] = useState("");
  const close = () => setDialog(null);
  const update = (change: (plan: Scenario) => Scenario) => {
    setError("");
    return updatePlan(scenario.id, change);
  };
  const timeline = calculateTimeline(scenario);
  const { groups, finalBalance } = timeline;

  function saveEvent(event: PayEvent) {
    return update((plan) => ({
      ...plan,
      events: plan.events.some(({ id }) => id === event.id)
        ? plan.events.map((existing) => existing.id === event.id ? event : existing)
        : [...plan.events, event],
    }));
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
    <>
      <a className="back-link" href="#/">시나리오 목록</a>
      <div className="page-heading">
        <div>
          <h1>{scenario.name}</h1>
          <p>입금 순서대로 계획을 적고, 항목을 처리할 때마다 남는 돈을 확인하세요.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "name" })}>이름 수정</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="editor-grid">
        <aside className="editor-sidebar" aria-label="시나리오 요약 및 도구">
          <div className="summary-card">
            <p>최종 예상 잔액</p>
            {groups.length ? <BalanceText balance={finalBalance} large /> : <strong className="summary-placeholder">—</strong>}
            <p className="summary-caption">{groups.length ? "전체 입금 기준 · 좋은 경우 ~ 나쁜 경우" : "입금을 추가하면 잔액을 볼 수 있어요."}</p>
          </div>
          <CurrentBalanceCard />
          <PrioritySummary timeline={timeline} />
          <div className="panel editor-tools">
            <span className="meta">세금 · {taxLabel(scenario)}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "tax" })}>세금 설정</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog({ type: "work" })}>근무수당 계산기</button>
            <button type="button" className="btn btn-secondary" disabled={!groups.length} onClick={() => setDialog({ type: "memo" })}>아이폰 메모 내보내기</button>
            <button type="button" className="btn btn-quiet danger-text" onClick={() => setDialog({ type: "delete-plan" })}>시나리오 삭제</button>
          </div>
          <MonthlyExpenses scenario={scenario} collapsible />
        </aside>
        <section className="timeline" aria-labelledby="timeline-heading">
          <div className="section-header">
            <h2 id="timeline-heading">입금과 항목</h2>
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ type: "event" })}>+ 입금 추가</button>
          </div>
          {groups.length ? (
            <TimelineView groups={groups} actions={{
              addItem: (event) => setDialog({ type: "item", event }),
              editEvent: (event) => setDialog({ type: "event", event }),
              deleteEvent: (event) => setDialog({ type: "delete-event", event }),
              editItem: (event, item) => setDialog({ type: "item", event, item }),
              deleteItem: (item) => setDialog({ type: "delete-item", item }),
              moveItem,
            }} />
          ) : (
            <div className="empty-panel">
              <h3>첫 입금을 추가해 보세요</h3>
              <p>입금액을 입력하면 그 아래에 지출이나 저축 같은 항목을 추가할 수 있어요.</p>
            </div>
          )}
        </section>
      </div>
      {dialog?.type === "name" && <NameDialog title="시나리오 이름 수정" name={scenario.name} onSave={(name) => update((plan) => ({ ...plan, name }))} onClose={close} />}
      {dialog?.type === "event" && <EventDialog event={dialog.event} draftAmount={dialog.draftAmount} onSave={saveEvent} onClose={close} />}
      {dialog?.type === "item" && <ItemDialog item={dialog.item} eventLabel={dialog.event.label} onSave={(item) => saveItem(dialog.event, item)} onClose={close} />}
      {dialog?.type === "work" && <WorkPayDialog onUse={(won) => setDialog({ type: "event", draftAmount: { min: won, max: won } })} onClose={close} />}
      {dialog?.type === "tax" && <TaxDialog scenario={scenario} onSave={(taxMode, customTaxBasisPoints) => update((plan) => ({ ...plan, taxMode, customTaxBasisPoints }))} onClose={close} />}
      {dialog?.type === "memo" && <MemoDialog text={formatMemo(timeline)} onClose={close} />}
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
      {dialog?.type === "delete-plan" && (
        <ConfirmAction title="시나리오를 삭제할까요?" description={"‘" + scenario.name + "’의 입금과 항목이 모두 삭제돼요."} actionLabel="시나리오 삭제" onClose={close}
          onConfirm={() => {
            location.hash = "/";
            removePlan(scenario.id);
          }} />
      )}
    </>
  );
}
