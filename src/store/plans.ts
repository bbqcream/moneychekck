import { createStore } from "zustand/vanilla";
import { createId } from "@/lib/create-id";
import { clearPlans, loadPlanData, savePlanData, validateBalances } from "@/lib/storage/local";
import { createPlanSync, type CloudConnection, type SyncPhase } from "@/lib/storage/plan-sync";
import type { PlanData } from "@/types/plan-data";
import type { Scenario, Won } from "@/types/scenario";

type Update = (scenario: Scenario) => Scenario;
type StorageIssue = "load" | "save" | null;

export type PlanStore = {
  data: PlanData;
  ready: boolean;
  storageIssue: StorageIssue;
  syncPhase: SyncPhase | null;
  draftIssue: boolean;
  refreshSync: () => void;
  restoreCloud: () => void;
  hydrate: () => void;
  createPlan: (name: string, source?: Partial<Pick<Scenario, "events" | "items" | "taxMode" | "customTaxBasisPoints" | "monthScope">>) => string;
  updatePlan: (id: string, update: Update) => string | null;
  removePlan: (id: string) => void;
  importData: (incoming: PlanData) => { added: number; skipped: number; balanceAdded: boolean };
  setCurrentBalance: (amount: Won | undefined) => void;
  clear: () => boolean;
};

export function createPlansStore(cloud?: CloudConnection) {
  let starting = false;
  const store = createStore<PlanStore>()((set, get) => {
    function commit(data: PlanData) {
      if (sync) {
        sync.stage(data);
        return;
      }
      let storageIssue = get().storageIssue;
      if (storageIssue !== "load") {
        try {
          savePlanData(data);
          storageIssue = null;
        } catch {
          storageIssue = "save";
        }
      }
      set({ data, storageIssue });
    }

    function commitScenarios(scenarios: Scenario[]) {
      commit({ ...get().data, scenarios });
    }

    return {
      data: { scenarios: [] },
      ready: false,
      storageIssue: null,
      syncPhase: cloud ? "loading" : null,
      draftIssue: false,
      refreshSync: () => { void sync?.refresh(); },
      restoreCloud: () => { void sync?.discardAndRefresh(); },
      hydrate: () => {
        if (sync) {
          if (!starting) {
            starting = true;
            void sync.start();
          }
          return;
        }
        if (get().ready) return;
        try {
          set({ data: loadPlanData(), ready: true });
        } catch {
          set({ ready: true, storageIssue: "load" });
        }
      },
      createPlan: (name, source) => {
        const id = createId();
        const now = new Date().toISOString();
        const scenario: Scenario = {
          events: [], items: [], taxMode: "none", ...source, id, name, createdAt: now, updatedAt: now,
        };
        commitScenarios([scenario, ...get().data.scenarios]);
        return id;
      },
      updatePlan: (id, update) => {
        const scenarios = get().data.scenarios;
        const current = scenarios.find((scenario) => scenario.id === id);
        if (!current) return "시나리오를 찾을 수 없어요.";
        const next = { ...update(current), updatedAt: new Date().toISOString() };
        try {
          validateBalances(next);
        } catch (error) {
          if (error instanceof RangeError) return error.message;
          throw error;
        }
        commitScenarios(scenarios.map((scenario) => scenario.id === id ? next : scenario));
        return null;
      },
      removePlan: (id) => commitScenarios(get().data.scenarios.filter((scenario) => scenario.id !== id)),
      importData: (incoming) => {
        const { scenarios, currentBalance } = get().data;
        const existingIds = new Set(scenarios.map(({ id }) => id));
        const added = incoming.scenarios.filter(({ id }) => !existingIds.has(id));
        const balanceAdded = currentBalance === undefined && incoming.currentBalance !== undefined;
        if (added.length || balanceAdded) {
          commit({ scenarios: [...added, ...scenarios], currentBalance: currentBalance ?? incoming.currentBalance });
        }
        return { added: added.length, skipped: incoming.scenarios.length - added.length, balanceAdded };
      },
      setCurrentBalance: (amount) => {
        const currentBalance = amount === undefined ? undefined : { amount, recordedAt: new Date().toISOString() };
        commit({ ...get().data, currentBalance });
      },
      clear: () => {
        if (sync) {
          commit({ scenarios: [] });
          return true;
        }
        try {
          clearPlans();
          set({ data: { scenarios: [] }, storageIssue: null });
          return true;
        } catch {
          if (get().storageIssue !== "load") set({ storageIssue: "save" });
          return false;
        }
      },
    };
  });
  const sync = cloud ? createPlanSync(cloud, ({ phase, data, draftIssue }) => {
    store.setState({ syncPhase: phase, draftIssue, ready: data !== undefined, data: data ?? { scenarios: [] } });
  }) : null;
  return store;
}
