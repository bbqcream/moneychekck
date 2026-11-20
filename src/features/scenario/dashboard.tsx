"use client";

import { useState } from "react";
import { BalanceText } from "@/components/balance-text";
import { ConfirmAction } from "@/components/confirm-action";
import { downloadPlanJson } from "@/features/export/download-json";
import { ImportDialog } from "@/features/export/import-dialog";
import { calculateTimeline } from "@/lib/calc/balance";
import { loadPlanData } from "@/lib/storage/local";
import { usePlans } from "@/store/provider";
import type { PlanData } from "@/types/plan-data";
import { CurrentBalanceCard } from "./current-balance-card";
import { examplePlan } from "./example";
import { MonthlyExpenses } from "./monthly-expenses";
import { NameDialog } from "./name-dialog";

const updatedDate = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
const planLink = (id: string) => "#/scenarios/" + id;

export function Dashboard() {
  const data = usePlans((state) => state.data);
  const createPlan = usePlans((state) => state.createPlan);
  const clear = usePlans((state) => state.clear);
  const importData = usePlans((state) => state.importData);
  const issue = usePlans((state) => state.storageIssue);
  const online = usePlans((state) => state.syncPhase !== null);
  const [dialog, setDialog] = useState<"new" | "clear" | "import" | null>(null);
  const [importStatus, setImportStatus] = useState("");
  const [fixedScenarioId, setFixedScenarioId] = useState("");
  const sorted = [...data.scenarios].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const latest = sorted[0];
  const fixedScenario = sorted.find(({ id }) => id === fixedScenarioId) ?? latest;
  const close = () => setDialog(null);

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
      scenarios: [{ ...examplePlan, id: "import-example", name: "월급과 지원금 예시", createdAt: now, updatedAt: now }],
    }, "payplan-example.json");
  }

  return (
    <>
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="hero-copy">
          <h1 id="dashboard-title">월급 시나리오</h1>
          <p>들어올 돈을 적고, 쓸 일과 모을 돈을 정해 보세요.<br className="hidden sm:block" /> 항목마다 남는 돈을 바로 확인할 수 있어요.</p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={() => setDialog("new")}>+ 새 시나리오</button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              location.hash = planLink(createPlan("월급과 지원금 예시", examplePlan));
            }}>예시로 시작</button>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="summary-card dashboard-summary">
            <p>최근 시나리오 잔액</p>
            {latest?.events.length ? <BalanceText balance={calculateTimeline(latest).finalBalance} large /> : <strong className="summary-placeholder">—</strong>}
            {latest ? (
              <a className="summary-caption summary-link" href={planLink(latest.id)}>{latest.name}</a>
            ) : <p className="summary-caption">시나리오를 추가하면 잔액을 볼 수 있어요.</p>}
          </div>
          <CurrentBalanceCard />
        </div>
      </section>
      <section className="panel mt-4 p-4 sm:p-5" aria-labelledby="home-fixed-title">
        <div className="section-header flex-wrap">
          <h2 id="home-fixed-title">월 고정지출</h2>
          {fixedScenario && sorted.length > 1 && (
            <label className="field w-full sm:w-auto">
              고정지출 시나리오
              <select value={fixedScenario.id} onChange={(event) => setFixedScenarioId(event.target.value)}>
                {sorted.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          )}
          {fixedScenario && sorted.length === 1 && <span className="meta">{fixedScenario.name}</span>}
        </div>
        {fixedScenario
          ? <MonthlyExpenses key={fixedScenario.id} scenario={fixedScenario} />
          : <p className="meta">시나리오를 만들면 월 고정지출을 추가할 수 있어요.</p>}
      </section>
      <section aria-labelledby="plans-title" className="plans-section">
        <div className="section-header">
          <div className="title-with-count">
            <h2 id="plans-title">내 시나리오</h2>
            <span className="badge badge-kind">{sorted.length}개</span>
          </div>
          {sorted.length > 0 && <a href="#/compare" className="btn btn-secondary">시나리오 비교</a>}
        </div>
        {sorted.length ? (
          <ul className="plans-grid">
            {sorted.map((scenario) => (
              <li key={scenario.id} className="plan-card">
                <a href={planLink(scenario.id)}>
                  <div className="plan-card-top">
                    <div className="min-w-0">
                      <h3>{scenario.name}</h3>
                      <p className="meta">입금 {scenario.events.length}건 · 항목 {scenario.items.length}개</p>
                    </div>
                    <span className="plan-open">열기</span>
                  </div>
                  <div className="plan-card-bottom">
                    <div>
                      <p className="meta">예상 잔액</p>
                      {scenario.events.length ? <BalanceText balance={calculateTimeline(scenario).finalBalance} /> : <span className="muted">입금 대기</span>}
                    </div>
                    <time className="meta" dateTime={scenario.updatedAt}>{updatedDate.format(new Date(scenario.updatedAt))}</time>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-panel empty-dashboard">
            <span className="empty-icon" aria-hidden="true"><i /><i /><i /></span>
            <div>
              <h3>아직 저장된 시나리오가 없어요</h3>
              <p>새 시나리오를 만들거나 예시를 열어 계획을 시작해 보세요.</p>
            </div>
          </div>
        )}
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
          <button type="button" className="btn btn-quiet danger-text" disabled={!sorted.length && !data.currentBalance && !issue} onClick={() => setDialog("clear")}>전체 삭제</button>
        </div>
      </section>
      {importStatus && <p className="meta mt-3" role="status">{importStatus}</p>}
      {dialog === "import" && <ImportDialog onClose={close} onImport={addImported} onDownloadExample={downloadExample} />}
      {dialog === "new" && <NameDialog title="새 시나리오" onSave={(name) => {
        location.hash = planLink(createPlan(name));
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
