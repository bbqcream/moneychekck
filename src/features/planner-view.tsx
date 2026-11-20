"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AccountStatus, type SignedInAccount } from "@/features/auth/account-status";
import { CompareView } from "@/features/compare/compare-view";
import { Dashboard } from "@/features/scenario/dashboard";
import { Editor } from "@/features/scenario/editor";
import { usePlans } from "@/store/provider";

function subscribe(listener: () => void) {
  const routeChanged = () => {
    window.scrollTo(0, 0);
    listener();
  };
  window.addEventListener("hashchange", routeChanged);
  return () => window.removeEventListener("hashchange", routeChanged);
}

function routeSnapshot() {
  return location.hash.slice(1) || "/";
}

export function PlannerView({ account }: { account?: SignedInAccount }) {
  const route = useSyncExternalStore(subscribe, routeSnapshot, () => "/");
  const scenarios = usePlans((state) => state.data.scenarios);
  const ready = usePlans((state) => state.ready);
  const storageIssue = usePlans((state) => state.storageIssue);
  const hydrate = usePlans((state) => state.hydrate);
  const refreshSync = usePlans((state) => state.refreshSync);
  useEffect(hydrate, [hydrate]);
  const online = account !== undefined;
  useEffect(() => {
    if (!online) return;
    window.addEventListener("focus", refreshSync);
    window.addEventListener("online", refreshSync);
    return () => {
      window.removeEventListener("focus", refreshSync);
      window.removeEventListener("online", refreshSync);
    };
  }, [online, refreshSync]);
  const compare = route === "/compare";
  const scenarioId = route.match(/^\/scenarios\/([^/]+)$/)?.[1];
  const scenario = scenarios.find(({ id }) => scenarioId === id);

  return (
    <>
      <header className="site-header">
        <div className="layout header-inner">
          <a className="brand" href="#/" aria-label="페이플랜 홈">
            <span className="brand-mark" aria-hidden="true">₩</span>
            <span>페이플랜</span>
          </a>
          <nav className="site-nav" aria-label="주 메뉴">
            <a href="#/" aria-current={!compare ? "page" : undefined}>시나리오</a>
            <a href="#/compare" aria-current={compare ? "page" : undefined}>비교</a>
          </nav>
        </div>
      </header>
      <main id="main-content" className="layout main-content">
        {account && <AccountStatus account={account} />}
        {storageIssue && (
          <p className="notice storage-notice" role="alert">
            {storageIssue === "load"
              ? "저장된 데이터를 읽지 못했어요. 기존 데이터는 보존되며, 지금 변경한 내용은 새로고침하면 사라질 수 있어요."
              : "이 브라우저에 저장하지 못했어요. 새로고침하기 전에 전체 JSON으로 내보낼 수 있어요."}
          </p>
        )}
        {!ready ? !account && <p className="muted loading" role="status">저장된 시나리오를 불러오고 있어요.</p>
          : compare ? <CompareView scenarios={scenarios} />
          : scenario ? <Editor key={scenario.id} scenario={scenario} />
          : scenarioId ? (
            <div className="empty-panel">
              <h1>시나리오를 찾을 수 없어요</h1>
              <p>이 브라우저에 저장된 다른 시나리오를 목록에서 열 수 있어요.</p>
              <a href="#/" className="btn btn-primary">시나리오 목록</a>
            </div>
          ) : <Dashboard />}
      </main>
    </>
  );
}
