"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import type { CloudConnection } from "@/lib/storage/plan-sync";
import { createPlansStore, type PlanStore } from "./plans";

const StoreContext = createContext<ReturnType<typeof createPlansStore> | null>(null);

export function PlansProvider({ children, cloud }: { children: ReactNode; cloud?: CloudConnection }) {
  const [store] = useState(() => createPlansStore(cloud));
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function usePlans<T>(select: (state: PlanStore) => T) {
  const store = useContext(StoreContext);
  if (!store) throw new Error("PlansProvider is required");
  return useStore(store, select);
}
