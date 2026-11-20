import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { accountConnection, getCloudClient } from "@/lib/storage/supabase";
import { PlansProvider } from "@/store/provider";
import { SignIn } from "./sign-in";
import { PlannerView } from "../planner-view";

export function AccountPlanner() {
  const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => {
    const { data: { subscription } } = getCloudClient().auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <main className="layout main-content"><p role="status">로그인 상태를 확인하고 있어요.</p></main>;
  }
  if (session === null) return <SignIn />;

  return (
    <PlansProvider key={session.user.id} cloud={accountConnection(session.user.id)}>
      <PlannerView account={{
        name: session.user.email?.split("@")[0]?.toUpperCase() ?? "계정",
        signOut: async () => {
          const { error } = await getCloudClient().auth.signOut({ scope: "local" });
          if (error) throw error;
        },
      }} />
    </PlansProvider>
  );
}
