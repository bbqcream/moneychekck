import { create } from "zustand";
import { createId } from "@/lib/create-id";
import { clearPlans, loadPlans, savePlans, validateBalances } from "@/lib/storage/local";
import type { Scenario } from "@/types/scenario";

type Update = (scenario: Scenario) => Scenario;
type StorageIssue = "load" | "save" | null;

type PlanStore = {
  scenarios: Scenario[];
  ready: boolean;
  storageIssue: StorageIssue;
  hydrate: () => void;
  createPlan: (name: string, source?: Pick<Scenario, "events" | "items" | "taxMode" | "customTaxBasisPoints">) => string;
  updatePlan: (id: string, update: Update) => string | null;
  removePlan: (id: string) => void;
  clear: () => boolean;
};

export const usePlans = create<PlanStore>((set, get) => {
  function commit(scenarios: Scenario[]) {
    let storageIssue = get().storageIssue;
    if (storageIssue !== "load") {
      try {
        savePlans(scenarios);
        storageIssue = null;
      } catch {
        storageIssue = "save";
      }
    }
    set({ scenarios, storageIssue });
  }

  return {
    scenarios: [],
    ready: false,
    storageIssue: null,
    hydrate: () => {
      if (get().ready) return;
      try {
        set({ scenarios: loadPlans(), ready: true });
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
      commit([scenario, ...get().scenarios]);
      return id;
    },
    updatePlan: (id, update) => {
      const scenarios = get().scenarios;
      const current = scenarios.find((scenario) => scenario.id === id);
      if (!current) return "시나리오를 찾을 수 없어요.";
      const next = { ...update(current), updatedAt: new Date().toISOString() };
      try {
        validateBalances(next);
      } catch (error) {
        if (error instanceof RangeError) return error.message;
        throw error;
      }
      commit(scenarios.map((scenario) => scenario.id === id ? next : scenario));
      return null;
    },
    removePlan: (id) => commit(get().scenarios.filter((scenario) => scenario.id !== id)),
    clear: () => {
      try {
        clearPlans();
        set({ scenarios: [], storageIssue: null });
        return true;
      } catch {
        if (get().storageIssue !== "load") set({ storageIssue: "save" });
        return false;
      }
    },
  };
});
