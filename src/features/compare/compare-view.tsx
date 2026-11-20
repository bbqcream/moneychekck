"use client";

import { useState } from "react";
import { BalanceText } from "@/components/balance-text";
import { incomeFilters, kindLabels } from "@/features/scenario/labels";
import { calculateTimeline, formatBalance, type TimelineItem } from "@/lib/calc/balance";
import { balanceDifference, compareTimelines } from "@/lib/calc/compare";
import type { IncomeFilter, Scenario } from "@/types/scenario";

type Choice = { id: string; filter: IncomeFilter };

function CompareChoice({ side, choice, scenario, scenarios, onChange }: {
  side: string;
  choice: Choice;
  scenario: Scenario;
  scenarios: Scenario[];
  onChange: (choice: Choice) => void;
}) {
  return (
    <div className="compare-controls">
      <label className="field">{side} 시나리오
        <select value={scenario.id} onChange={(event) => onChange({ ...choice, id: event.target.value })}>
          {scenarios.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="field">{side} 입금 범위
        <select value={choice.filter} onChange={(event) => onChange({ ...choice, filter: event.target.value === "confirmed" ? "confirmed" : "all" })}>
          <option value="confirmed">{incomeFilters.confirmed}</option>
          <option value="all">{incomeFilters.all}</option>
        </select>
      </label>
    </div>
  );
}

function CompareItem({ entry }: { entry?: TimelineItem & { eventLabel: string } }) {
  if (!entry) return <div className="compare-cell absent">해당 항목 없음</div>;
  return (
    <div className="compare-cell">
      <h3>{entry.item.label}</h3>
      <p className="meta">{entry.eventLabel} · {kindLabels[entry.item.kind]}</p>
      <div className="compare-balance">
        <span>항목 후 잔액</span>
        <BalanceText balance={entry.balance} />
      </div>
    </div>
  );
}

export function CompareView({ scenarios }: { scenarios: Scenario[] }) {
  const [left, setLeft] = useState<Choice>({ id: scenarios[0]?.id ?? "", filter: "confirmed" });
  const [right, setRight] = useState<Choice>({ id: (scenarios[1] ?? scenarios[0])?.id ?? "", filter: "all" });
  const leftScenario = scenarios.find(({ id }) => left.id === id) ?? scenarios[0];
  const rightScenario = scenarios.find(({ id }) => right.id === id) ?? scenarios[1] ?? scenarios[0];

  if (!leftScenario || !rightScenario) {
    return (
      <>
        <div className="page-heading"><h1>시나리오 비교</h1></div>
        <div className="empty-panel">
          <h2>비교할 시나리오가 없어요</h2>
          <p>목록에서 시나리오를 만든 뒤 입금을 추가해 보세요.</p>
          <a className="btn btn-primary" href="#/">시나리오 목록</a>
        </div>
      </>
    );
  }

  const leftTimeline = calculateTimeline(leftScenario, left.filter);
  const rightTimeline = calculateTimeline(rightScenario, right.filter);
  const rows = compareTimelines(leftTimeline, rightTimeline);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>시나리오 비교</h1>
          <p>미정 입금을 포함했을 때 최종 잔액과 항목별 잔액이 얼마나 바뀌는지 확인하세요.</p>
        </div>
      </div>
      <section className="panel compare-panel" aria-label="최종 잔액 비교">
        <div className="compare-grid">
          <div className="compare-cell">
            <CompareChoice side="왼쪽" choice={left} scenario={leftScenario} scenarios={scenarios} onChange={setLeft} />
            <div className="compare-final">
              <p>최종 잔액</p>
              <BalanceText balance={leftTimeline.finalBalance} large />
              {!leftTimeline.groups.length && <p className="meta">선택 범위의 입금 없음</p>}
            </div>
          </div>
          <div className="compare-cell">
            <CompareChoice side="오른쪽" choice={right} scenario={rightScenario} scenarios={scenarios} onChange={setRight} />
            <div className="compare-final">
              <p>최종 잔액</p>
              <BalanceText balance={rightTimeline.finalBalance} large />
              {!rightTimeline.groups.length && <p className="meta">선택 범위의 입금 없음</p>}
            </div>
          </div>
        </div>
        <div className="compare-difference">
          <span>최종 잔액 차이</span>
          <strong>{formatBalance(balanceDifference(leftTimeline.finalBalance, rightTimeline.finalBalance), true)}만원</strong>
        </div>
      </section>
      <section className="compare-details" aria-labelledby="compare-items-title">
        <div className="section-header">
          <div>
            <h2 id="compare-items-title">항목별 잔액</h2>
            <p className="muted">같은 이름과 종류의 항목을 등장 순서대로 맞춰요. 차이는 오른쪽 잔액에서 왼쪽 잔액을 뺀 값이에요.</p>
          </div>
        </div>
        {rows.length ? (
          <ul className="panel compare-list">
            {rows.map(({ key, left, right, difference }) => (
              <li key={key}>
                <div className="compare-grid">
                  <CompareItem entry={left} />
                  <CompareItem entry={right} />
                </div>
                {difference && (
                  <div className="compare-difference">
                    <span>항목 후 잔액 차이</span>
                    <strong>{formatBalance(difference, true)}만원</strong>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <div className="empty-panel"><p>선택한 입금에 연결된 항목이 없어요.</p></div>}
      </section>
    </>
  );
}
