"use client";

import { AccountPlanner } from "@/features/auth/account-planner";
import { cloudEnabled } from "@/lib/storage/supabase";
import { PlansProvider } from "@/store/provider";
import { PlannerView } from "./planner-view";

export function Planner() {
  if (cloudEnabled) return <AccountPlanner />;
  return <PlansProvider><PlannerView /></PlansProvider>;
}
