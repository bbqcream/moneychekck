"use client";

import { useState } from "react";
import { BalanceText } from "@/components/balance-text";
import { ConfirmAction } from "@/components/confirm-action";
import { ImportDialog } from "@/features/export/import-dialog";
import { calculateTimeline } from "@/lib/calc/balance";
import { loadPlans, serializePlans } from "@/lib/storage/local";
import { usePlans } from "@/store/provider";
import type { Scenario } from "@/types/scenario";
import { examplePlan } from "./example";
import { NameDialog } from "./name-dialog";

const updatedDate = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
const planLink = (id: string) => "#/scenarios/" + id;

export function Dashboard({ scenarios }: { scenarios: Scenario[] }) {
  const createPlan = usePlans((state) => state.createPlan);
  const clear = usePlans((state) => state.clear);
  const importPlans = usePlans((state) => state.importPlans);
  const issue = usePlans((state) => state.storageIssue);
  const online = usePlans((state) => state.syncPhase !== null);
  const [dialog, setDialog] = useState<"new" | "clear" | "import" | null>(null);
  const [importStatus, setImportStatus] = useState("");
  const sorted = [...scenarios].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const latest = sorted[0];
  const close = () => setDialog(null);

  function addImported(plans: Scenario[]) {
    const added = importPlans(plans);
    setImportStatus(added ? "시나리오 " + added + "개를 불러왔어요." : "새로 불러올 시나리오가 없어요.");
  }

  function download() {
    const url = URL.createObjectURL(new Blob([serializePlans(scenarios)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "payplan-backup.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <div className="summary-card dashboard-summary">
          <p>최근 시나리오 잔액</p>
          {latest?.events.length ? <BalanceText balance={calculateTimeline(latest).finalBalance} large /> : <strong className="summary-placeholder">—</strong>}
          {latest ? (
            <a className="summary-caption summary-link" href={planLink(latest.id)}>{latest.name}</a>
          ) : <p className="summary-caption">시나리오를 추가하면 잔액을 볼 수 있어요.</p>}
        </div>
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
              addImported(loadPlans());
            } catch {
              setImportStatus("이 브라우저에서 이전에 저장한 시나리오를 읽을 수 없어요.");
            }
          }}>기존 브라우저 계획 가져오기</button>}
          <button type="button" className="btn btn-secondary" onClick={() => setDialog("import")}>JSON 불러오기</button>
          <button type="button" className="btn btn-secondary" onClick={download}>전체 JSON 내보내기</button>
          <button type="button" className="btn btn-quiet danger-text" disabled={!sorted.length && !issue} onClick={() => setDialog("clear")}>전체 삭제</button>
        </div>
      </section>
      {importStatus && <p className="meta mt-3" role="status">{importStatus}</p>}
      {dialog === "import" && <ImportDialog onClose={close} onImport={addImported} />}
      {dialog === "new" && <NameDialog title="새 시나리오" onSave={(name) => {
        location.hash = planLink(createPlan(name));
      }} onClose={close} />}
      {dialog === "clear" && (
        <ConfirmAction title={online ? "계정 데이터를 모두 삭제할까요?" : "로컬 데이터를 모두 삭제할까요?"}
          description={online
            ? "같은 계정으로 접속한 모든 기기에 삭제가 반영돼요. 삭제한 데이터는 복구할 수 없어요."
            : "이 브라우저에 저장된 모든 시나리오와 항목이 삭제돼요. 삭제한 데이터는 복구할 수 없어요."}
          actionLabel="전체 삭제" onClose={close}
          onConfirm={() => clear() ? undefined : "브라우저 저장소를 지우지 못했어요. 저장 권한을 확인해 주세요."} />
      )}
    </>
  );
}
