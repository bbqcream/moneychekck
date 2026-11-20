import { describe, expect, it, vi } from "vitest";
import { parsePlanDocument, serializePlanData } from "@/lib/storage/local";
import { createPlanSync, type CloudConnection, type Draft, type Snapshot } from "@/lib/storage/plan-sync";
import { accountConnection } from "@/lib/storage/supabase";
import { createPlansStore } from "@/store/plans";
import { paycheck } from "./fixtures/paycheck";

function testCloud(initial: Snapshot) {
  let remote = initial;
  let disconnected = false;
  let loseReply = false;
  return {
    remote: () => remote,
    offline: (value: boolean) => { disconnected = value; },
    loseNextReply: () => { loseReply = true; },
    device: () => {
      let draft: Draft | undefined;
      const connection: CloudConnection = {
        readDraft: () => draft,
        writeDraft: (next) => { draft = next; },
        transport: {
          read: async () => {
            if (disconnected) throw new Error("offline");
            return remote;
          },
          write: async (revision, mutationId, data) => {
            if (disconnected) throw new Error("offline");
            if (remote.revision !== revision) return false;
            remote = { revision: revision + 1, mutationId, data };
            if (loseReply) {
              loseReply = false;
              throw new Error("interrupted response");
            }
            return true;
          },
        },
      };
      return { connection, draft: () => draft };
    },
  };
}

describe("계획 백업", () => {
  const currentBalance = { amount: 123456, recordedAt: "2026-11-20T00:00:00.000Z" };

  it("입금 메모, 월 고정지출, 우선순위와 현재 잔고를 한 번에 가져온다", () => {
    const plan = {
      ...paycheck,
      events: [{ ...paycheck.events[0], note: "12월 예정" }],
      items: [{ ...paycheck.items[0], priority: "P1" as const }],
      monthlyExpenses: [{
        id: "transport", label: "교통비", priority: "P2" as const,
        rates: [{ startMonth: "2027-01", amount: { min: 60000, max: 60000 } }],
      }],
    };
    const data = { scenarios: [plan], currentBalance };
    expect(parsePlanDocument(serializePlanData(data))).toEqual(data);
  });

  it("기존 백업을 읽고, 중복 시나리오와 잘못된 우선순위나 잔고는 거절한다", () => {
    expect(parsePlanDocument(serializePlanData({ scenarios: [paycheck] })).scenarios).toEqual([paycheck]);
    expect(() => parsePlanDocument(serializePlanData({ scenarios: [paycheck, paycheck] }))).toThrow();
    expect(() => parsePlanDocument('{"version":2,"scenarios":[]}')).toThrow();
    const invalid = { ...paycheck, items: [{ ...paycheck.items[0], priority: "P4" }] };
    expect(() => parsePlanDocument(JSON.stringify({ version: 1, scenarios: [invalid] }))).toThrow();
    expect(() => parsePlanDocument(serializePlanData({ scenarios: [], currentBalance: { ...currentBalance, amount: 4.5 } }))).toThrow();
  });

  it("여러 계획을 추가하면서 이미 저장된 잔고와 시나리오를 유지한다", () => {
    vi.stubGlobal("localStorage", { setItem: vi.fn() });
    try {
      const store = createPlansStore();
      store.getState().importData({ scenarios: [paycheck], currentBalance });
      const added = { ...paycheck, id: "new" };
      const result = store.getState().importData({
        scenarios: [{ ...paycheck, name: "겹치는 계획" }, added],
        currentBalance: { ...currentBalance, amount: 5000 },
      });
      expect(result).toEqual({ added: 1, skipped: 1, balanceAdded: false });
      expect(store.getState().data).toEqual({ scenarios: [added, paycheck], currentBalance });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("계정 동기화", () => {
  const initial = { revision: 1, mutationId: "original", data: { scenarios: [paycheck] } };

  it("기존 버전의 동기화 대기 변경을 복구한다", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => JSON.stringify({
        revision: 1, mutationId: "original", pendingId: "pending", attemptedId: null, plans: [paycheck],
      }),
    });
    try {
      expect(accountConnection("test-account").readDraft()).toMatchObject({
        pendingId: "pending", data: { scenarios: [paycheck] },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("다른 기기가 저장한 버전을 읽고, 오래된 편집을 덮어쓰지 않는다", async () => {
    const cloud = testCloud(initial);
    const first = cloud.device();
    const second = cloud.device();
    const firstSync = createPlanSync(first.connection, () => {});
    let phase = "";
    const secondSync = createPlanSync(second.connection, (state) => { phase = state.phase; });
    await Promise.all([firstSync.start(), secondSync.start()]);
    const currentBalance = { amount: 0, recordedAt: "2026-11-20T00:00:00.000Z" };
    firstSync.stage({ scenarios: [{ ...paycheck, name: "폰" }], currentBalance });
    await firstSync.refresh();
    secondSync.stage({ scenarios: [{ ...paycheck, name: "PC" }] });
    await secondSync.refresh();
    expect(phase).toBe("conflict");
    expect(cloud.remote().data.scenarios[0].name).toBe("폰");
    expect(second.draft()?.data.scenarios[0].name).toBe("PC");
    await secondSync.discardAndRefresh();
    expect(second.draft()?.data.scenarios[0].name).toBe("폰");
    expect(second.draft()?.data.currentBalance).toEqual(currentBalance);
  });

  it("연결이 끊긴 변경을 같은 탭에서 다시 불러와 동기화한다", async () => {
    const cloud = testCloud(initial);
    const device = cloud.device();
    const sync = createPlanSync(device.connection, () => {});
    await sync.start();
    cloud.offline(true);
    sync.stage({ scenarios: [{ ...paycheck, name: "오프라인 변경" }] });
    await sync.refresh();
    expect(device.draft()?.pendingId).toBeTruthy();
    cloud.offline(false);
    await createPlanSync(device.connection, () => {}).start();
    expect(cloud.remote().data.scenarios[0].name).toBe("오프라인 변경");
    expect(device.draft()?.pendingId).toBeNull();
  });

  it("쓰기 응답을 잃어도 이미 저장된 같은 변경을 다시 적용하지 않는다", async () => {
    const cloud = testCloud(initial);
    const device = cloud.device();
    const sync = createPlanSync(device.connection, () => {});
    await sync.start();
    cloud.loseNextReply();
    sync.stage({ scenarios: [{ ...paycheck, name: "응답이 유실된 변경" }] });
    await sync.refresh();
    expect(cloud.remote().revision).toBe(2);
    expect(device.draft()?.pendingId).toBeNull();
  });
});
