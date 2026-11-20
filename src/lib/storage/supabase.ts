import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decodePlanData, decodePlanDocument, planDocument } from "./local";
import type { CloudConnection, Draft, Snapshot } from "./plan-sync";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const cloudEnabled = Boolean(url && key);

type Row = {
  user_id: string;
  revision: number;
  mutation_id: string;
  document: ReturnType<typeof planDocument>;
};

type Database = {
  public: {
    Tables: {
      payplan_documents: {
        Row: Row;
        Insert: Row;
        Update: Partial<Omit<Row, "user_id">>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
};

let client: SupabaseClient<Database> | undefined;

export function getCloudClient() {
  if (!url || !key) throw new Error("Supabase configuration is missing");
  return client ??= createClient<Database>(url, key);
}

const empty: Snapshot = { revision: 0, mutationId: null, data: { scenarios: [] } };

function readDraft(key: string): Draft | undefined {
  const raw = sessionStorage.getItem(key);
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as (Partial<Draft> & { plans?: unknown }) | null;
  const isId = (value: unknown): value is string | null => value === null || typeof value === "string";
  if (!parsed || typeof parsed.revision !== "number" || !Number.isSafeInteger(parsed.revision) ||
    parsed.revision < 0 || !isId(parsed.mutationId) || !isId(parsed.pendingId) ||
    !isId(parsed.attemptedId)) throw new Error("Invalid sync draft");
  return {
    revision: parsed.revision,
    mutationId: parsed.mutationId,
    pendingId: parsed.pendingId,
    attemptedId: parsed.attemptedId,
    data: decodePlanData(parsed.data ?? { scenarios: parsed.plans }),
  };
}

export function accountConnection(userId: string): CloudConnection {
  const storageKey = "payplan:account-draft:" + userId;
  return {
    readDraft: () => readDraft(storageKey),
    writeDraft: (draft) => sessionStorage.setItem(storageKey, JSON.stringify(draft)),
    transport: {
      read: async () => {
        const { data, error } = await getCloudClient().from("payplan_documents")
          .select("revision, mutation_id, document").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (!data) return empty;
        return { revision: data.revision, mutationId: data.mutation_id, data: decodePlanDocument(data.document) };
      },
      write: async (revision, mutationId, planData) => {
        const table = getCloudClient().from("payplan_documents");
        const data = { revision: revision + 1, mutation_id: mutationId, document: planDocument(planData) };
        if (!revision) {
          const { error } = await table.insert({ ...data, user_id: userId });
          if (error?.code === "23505") return false;
          if (error) throw error;
          return true;
        }
        const { data: saved, error } = await table.update(data)
          .eq("user_id", userId).eq("revision", revision).select("revision").maybeSingle();
        if (error) throw error;
        return saved !== null;
      },
    },
  };
}
