"use client";

import { useEffect, useRef, useState } from "react";
import { BalanceText } from "@/components/balance-text";
import { ConfirmAction } from "@/components/confirm-action";
import { downloadPlanJson } from "@/features/export/download-json";
import { ImportDialog } from "@/features/export/import-dialog";
import { calculateTimeline } from "@/lib/calc/balance";
import { eventPlanningMonth } from "@/lib/calc/monthly-overview";
import { loadPlanData } from "@/lib/storage/local";
import { usePlans } from "@/store/provider";
import type { PlanData } from "@/types/plan-data";
import { CurrentBalanceCard } from "./current-balance-card";
import { Editor } from "./editor";
import { examplePlan } from "./example";
import { MonthlyOverview } from "./monthly-overview";
import { MonthlyRules } from "./monthly-rules";
import { MonthlySalaryCard } from "./monthly-salary-card";
import { getMonthlyWorkspace } from "./monthly-workspace";
import { NameDialog } from "./name-dialog";

const updatedDate = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
export function Dashboard({ month, setMonth, initialDetailId }: { month: string; setMonth: (month: string) => void; initialDetailId?: string }) {
  const data = usePlans((state) => state.data);
  const createPlan = usePlans((state) => state.createPlan);
  const clear = usePlans((state) => state.clear);
  const importData = usePlans((state) => state.importData);
  const issue = usePlans((state) => state.storageIssue);
  const online = usePlans((state) => state.syncPhase !== null);
  const [dialog, setDialog] = useState<"new" | "clear" | "import" | null>(null);
  const [importStatus, setImportStatus] = useState("");
  const [detailId, setDetailId] = useState(initialDetailId);
  const detailPanel = useRef<HTMLDivElement>(null);
  const { base, details } = getMonthlyWorkspace(data.scenarios, month);
  const timeline = base && calculateTimeline(base, "all", "budget");
  const detail = details.find(({ scenario }) => scenario.id === detailId)?.scenario;
  const pending = base?.events.filter((event) => event.date === null && eventPlanningMonth(base, event) === month) ?? [];
  const close = () => setDialog(null);

  useEffect(() => { if (detailId) detailPanel.current?.focus(); }, [detailId]);

  function selectMonth(value: string) {
    setDetailId(undefined);
    setMonth(value);
  }

  function closeDetail() {
    setDetailId(undefined);
    if (initialDetailId) window.location.replace("#/?month=" + month);
  }

  function addImported(imported: PlanData) {
    const { added, skipped, balanceAdded } = importData(imported);
    const result = [
      added > 0 && "시나리오 " + added + "개를 불러왔어요.",
      balanceAdded && "현재 잔고를 불러왔어요.",
      skipped > 0 && "이미 있는 시나리오 " + skipped + "개는 유지했어요.",
    ].filter(Boolean);
    setImportStatus(result.join(" ") || "새로 불러올 데이터가 없어요.");
  }

  function downloadExample() {
    const now = new Date().toISOString();
    downloadPlanJson({
      scenarios: [{
        ...examplePlan, id: "import-example", name: "월급과 지원금 예시", createdAt: now, updatedAt: now,
        monthlySalary: { label: "회사 월급", amount: 960000, day: 10, startMonth: "2026-12", endMonth: "2027-02" },
        monthlySavings: [{
          id: "example-savings", label: "월 적립 예시",
          allocation: { savingsPercent: 80, savingsLabel: "비상금", investmentLabel: "장기 투자" },
          rates: [{ startMonth: "2026-11", amount: { min: 100000, max: 100000 } }],
        }],
      }],
    }, "payplan-example.json");
  }

  return (
    <>
      <div className="page-heading"><h1>월별 가계 계획</h1></div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <MonthlyOverview timeline={timeline} month={month} setMonth={selectMonth} pending={pending} />
        <CurrentBalanceCard />
      </div>
      <Editor key={month} mode="base" month={month} scenario={base} />
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="고정 월급·지출·저축">
        <MonthlySalaryCard key={"salary-" + base?.id} scenario={base} month={month} />
        <MonthlyRules key={"expense-" + base?.id} scenario={base} kind="expense" month={month} />
        <MonthlyRules key={"saving-" + base?.id} scenario={base} kind="saving" />
      </section>
      <section aria-labelledby="plans-title" className="plans-section">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans-title">{Number(month.slice(5))}월 세부 시나리오</h2>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={() => setDialog("new")}>+ 세부 시나리오</button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              const events = examplePlan.events.map((event) => ({ ...event, date: event.date ? month + event.date.slice(7) : null }));
              setDetailId(createPlan("월급과 지원금 예시", { ...examplePlan, events, monthScope: month }));
            }}>예시로 시작</button>
            {data.scenarios.length > 0 && <a href="#/compare" className="btn btn-secondary">시나리오 비교</a>}
          </div>
        </div>
        {details.length ? (
          <ul className="plans-grid">
            {details.map(({ scenario, timeline }) => (
              <li key={scenario.id} className="plan-card">
                <button type="button" aria-expanded={detail?.id === scenario.id}
                  aria-controls={detail?.id === scenario.id ? "detail-plan-editor" : undefined}
                  onClick={() => detail?.id === scenario.id ? closeDetail() : setDetailId(scenario.id)}>
                  <div className="plan-card-top">
                    <div className="min-w-0">
                      <h3>{scenario.name}</h3>
                      <p className="meta">입금 {timeline.groups.length}건 · 항목 {scenario.items.length}개</p>
                    </div>
                    <span className="plan-open">{detail?.id === scenario.id ? "접기" : "펼치기"}</span>
                  </div>
                  <div className="plan-card-bottom">
                    <div>
                      <p className="meta">예상 잔액</p>
                      {timeline.groups.length ? <BalanceText balance={timeline.finalBalance} /> : <span className="muted">입금 대기</span>}
                    </div>
                    <time className="meta" dateTime={scenario.updatedAt}>{updatedDate.format(new Date(scenario.updatedAt))}</time>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-panel empty-dashboard">
            <span className="empty-icon" aria-hidden="true"><i /><i /><i /></span>
            <div>
              <h3>이달에 만든 세부 시나리오가 없어요</h3>
            </div>
          </div>
        )}
        {detail && <div id="detail-plan-editor" ref={detailPanel} tabIndex={-1} className="mt-3 scroll-mt-4 rounded-2xl border border-line bg-paper px-3 pb-3 sm:px-5 sm:pb-5">
          <Editor key={detail.id} mode="detail" month={month} scenario={detail} onDelete={closeDetail} />
        </div>}
      </section>
      <section className="data-bar" aria-labelledby="data-title">
        <div>
          <h2 id="data-title">{online ? "계정 데이터" : "로컬 데이터"}</h2>
          <p className="meta">{online ? "같은 계정으로 로그인한 기기와 동기화돼요." : "이 브라우저에 저장돼요."}</p>
        </div>
        <div className="button-row">
          {online && <button type="button" className="btn btn-secondary" onClick={() => {
            try {
              addImported(loadPlanData());
            } catch {
              setImportStatus("이 브라우저에서 이전에 저장한 시나리오를 읽을 수 없어요.");
            }
          }}>기존 브라우저 계획 가져오기</button>}
          <button type="button" className="btn btn-secondary" onClick={() => setDialog("import")}>JSON 불러오기</button>
          <button type="button" className="btn btn-secondary" onClick={() => downloadPlanJson(data, "payplan-backup.json")}>전체 JSON 내보내기</button>
          <button type="button" className="btn btn-quiet danger-text" disabled={!data.scenarios.length && !data.currentBalance && !issue} onClick={() => setDialog("clear")}>전체 삭제</button>
        </div>
      </section>
      {importStatus && <p className="meta mt-3" role="status">{importStatus}</p>}
      {dialog === "import" && <ImportDialog onClose={close} onImport={addImported} onDownloadExample={downloadExample} />}
      {dialog === "new" && <NameDialog title={`${Number(month.slice(5))}월 세부 시나리오 추가`} onSave={(name) => {
        setDetailId(createPlan(name, { monthScope: month }));
      }} onClose={close} />}
      {dialog === "clear" && (
        <ConfirmAction title={online ? "계정 데이터를 모두 삭제할까요?" : "로컬 데이터를 모두 삭제할까요?"}
          description={online
            ? "시나리오와 현재 잔고가 같은 계정의 모든 기기에서 삭제돼요. 삭제한 데이터는 복구할 수 없어요."
            : "이 브라우저에 저장된 모든 시나리오와 현재 잔고가 삭제돼요. 삭제한 데이터는 복구할 수 없어요."}
          actionLabel="전체 삭제" onClose={close}
          onConfirm={() => clear() ? undefined : "브라우저 저장소를 지우지 못했어요. 저장 권한을 확인해 주세요."} />
      )}
    </>
  );
}
