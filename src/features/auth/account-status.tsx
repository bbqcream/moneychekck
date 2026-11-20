import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import type { SyncPhase } from "@/lib/storage/plan-sync";
import { usePlans } from "@/store/provider";

export type SignedInAccount = { name: string; signOut: () => Promise<void> };

const syncLabel: Record<SyncPhase, string> = {
  loading: "계정 데이터를 불러오고 있어요.",
  syncing: "계정 데이터를 동기화하고 있어요.",
  synced: "동기화 완료",
  error: "지금은 동기화할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.",
  conflict: "다른 기기에서 수정한 내용이 있어요. 이 탭의 변경은 JSON으로 저장할 수 있어요.",
};

export function AccountStatus({ account }: { account: SignedInAccount }) {
  const phase = usePlans((state) => state.syncPhase);
  const draftIssue = usePlans((state) => state.draftIssue);
  const refresh = usePlans((state) => state.refreshSync);
  const restore = usePlans((state) => state.restoreCloud);
  const [replace, setReplace] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  return (
    <section className="panel mb-4 p-3 sm:p-4" aria-label="계정과 동기화">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong>{account.name}</strong>
          {phase && <p className="meta" role={phase === "error" || phase === "conflict" ? "alert" : "status"}>{syncLabel[phase]}</p>}
        </div>
        <div className="button-row">
          {phase === "conflict"
            ? <button type="button" className="btn btn-secondary" onClick={() => setReplace(true)}>서버 버전 불러오기</button>
            : <button type="button" className="btn btn-secondary" disabled={phase === "loading" || phase === "syncing"} onClick={refresh}>동기화</button>}
          <button type="button" className="btn btn-quiet" disabled={signingOut} onClick={async () => {
            setSigningOut(true);
            setError("");
            try {
              await account.signOut();
              location.hash = "/";
            } catch {
              setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
              setSigningOut(false);
            }
          }}>로그아웃</button>
        </div>
      </div>
      {draftIssue && phase !== "synced" && <p role="alert" className="notice mt-2">이 탭에도 임시 저장을 하지 못했어요. 창을 닫기 전에 JSON으로 내보낼 수 있어요.</p>}
      {error && <p role="alert" className="form-error mt-2">{error}</p>}
      {replace && (
        <ConfirmAction title="서버 버전을 불러올까요?"
          description="이 탭에 남은 동기화 대기 변경은 삭제돼요."
          actionLabel="서버 버전 불러오기" onClose={() => setReplace(false)} onConfirm={restore} />
      )}
    </section>
  );
}
