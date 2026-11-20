import { describe, expect, it } from "vitest";
import { parsePlans, serializePlans } from "@/lib/storage/local";
import { createPlanSync, type CloudConnection, type Draft, type Snapshot } from "@/lib/storage/plan-sync";
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
          write: async (revision, mutationId, plans) => {
            if (disconnected) throw new Error("offline");
            if (remote.revision !== revision) return false;
            remote = { revision: revision + 1, mutationId, plans };
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
  it("입금 메모와 월 고정지출 규칙을 가져온다", () => {
    const plan = {
      ...paycheck,
      events: [{ ...paycheck.events[0], note: "12월 예정" }],
      monthlyExpenses: [{
        id: "transport", label: "교통비",
        rates: [{ startMonth: "2027-01", amount: { min: 60000, max: 60000 } }],
      }],
    };
    expect(parsePlans(serializePlans([plan]))).toEqual([plan]);
  });

  it("중복된 시나리오와 잘못된 백업 버전을 거절한다", () => {
    expect(() => parsePlans(serializePlans([paycheck, paycheck]))).toThrow();
    expect(() => parsePlans('{"version":2,"scenarios":[]}')).toThrow();
  });
});

describe("계정 동기화", () => {
  const initial = { revision: 1, mutationId: "original", plans: [paycheck] };

  it("다른 기기가 저장한 버전을 읽고, 오래된 편집을 덮어쓰지 않는다", async () => {
    const cloud = testCloud(initial);
    const first = cloud.device();
    const second = cloud.device();
    const firstSync = createPlanSync(first.connection, () => {});
    let phase = "";
    const secondSync = createPlanSync(second.connection, (state) => { phase = state.phase; });
    await Promise.all([firstSync.start(), secondSync.start()]);
    firstSync.stage([{ ...paycheck, name: "폰" }]);
    await firstSync.refresh();
    secondSync.stage([{ ...paycheck, name: "PC" }]);
    await secondSync.refresh();
    expect(phase).toBe("conflict");
    expect(cloud.remote().plans[0].name).toBe("폰");
    expect(second.draft()?.plans[0].name).toBe("PC");
    await secondSync.discardAndRefresh();
    expect(second.draft()?.plans[0].name).toBe("폰");
  });

  it("연결이 끊긴 변경을 같은 탭에서 다시 불러와 동기화한다", async () => {
    const cloud = testCloud(initial);
    const device = cloud.device();
    const sync = createPlanSync(device.connection, () => {});
    await sync.start();
    cloud.offline(true);
    sync.stage([{ ...paycheck, name: "오프라인 변경" }]);
    await sync.refresh();
    expect(device.draft()?.pendingId).toBeTruthy();
    cloud.offline(false);
    await createPlanSync(device.connection, () => {}).start();
    expect(cloud.remote().plans[0].name).toBe("오프라인 변경");
    expect(device.draft()?.pendingId).toBeNull();
  });

  it("쓰기 응답을 잃어도 이미 저장된 같은 변경을 다시 적용하지 않는다", async () => {
    const cloud = testCloud(initial);
    const device = cloud.device();
    const sync = createPlanSync(device.connection, () => {});
    await sync.start();
    cloud.loseNextReply();
    sync.stage([{ ...paycheck, name: "응답이 유실된 변경" }]);
    await sync.refresh();
    expect(cloud.remote().revision).toBe(2);
    expect(device.draft()?.pendingId).toBeNull();
  });
});
