import { createId } from "@/lib/create-id";
import type { Scenario } from "@/types/scenario";

export type Snapshot = { revision: number; mutationId: string | null; plans: Scenario[] };
export type Draft = Snapshot & { pendingId: string | null; attemptedId: string | null };
export type SyncPhase = "loading" | "syncing" | "synced" | "error" | "conflict";

export type SyncTransport = {
  read: () => Promise<Snapshot>;
  write: (revision: number, mutationId: string, plans: Scenario[]) => Promise<boolean>;
};

export type CloudConnection = {
  transport: SyncTransport;
  readDraft: () => Draft | undefined;
  writeDraft: (draft: Draft) => void;
};

type SyncState = { phase: SyncPhase; plans?: Scenario[]; draftIssue: boolean };

export function createPlanSync(connection: CloudConnection, publish: (state: SyncState) => void) {
  let draft: Draft | undefined;
  let draftIssue = false;
  let conflicted = false;
  let tail: Promise<void> = Promise.resolve();

  function emit(phase: SyncPhase) {
    publish({ phase, plans: draft?.plans, draftIssue });
  }

  function persist(next: Draft) {
    draft = next;
    try {
      connection.writeDraft(next);
      draftIssue = false;
    } catch {
      draftIssue = true;
    }
  }

  async function reconcile(discard?: { pendingId: string | null }) {
    if (conflicted && !discard) return;
    if (draft) emit("syncing");
    const remote = await connection.transport.read();

    if (discard && (draft?.pendingId ?? null) !== discard.pendingId) {
      emit("conflict");
      return;
    }
    if (!draft?.pendingId || discard) {
      conflicted = false;
      persist({ ...remote, pendingId: null, attemptedId: null });
      emit("synced");
      return;
    }
    if (remote.revision !== draft.revision) {
      if (!draft.attemptedId || remote.mutationId !== draft.attemptedId) {
        conflicted = true;
        emit("conflict");
        return;
      }
      persist({
        ...draft,
        revision: remote.revision,
        mutationId: remote.mutationId,
        pendingId: draft.attemptedId === draft.pendingId ? null : draft.pendingId,
        attemptedId: null,
      });
    }

    const pending = draft.pendingId;
    if (!pending) {
      emit("synced");
      return;
    }
    const startingRevision = draft.revision;
    persist({ ...draft, attemptedId: pending });
    const saved = await connection.transport.write(startingRevision, pending, draft.plans);
    if (!saved) {
      conflicted = true;
      emit("conflict");
      return;
    }
    persist({
      ...draft,
      revision: startingRevision + 1,
      mutationId: pending,
      pendingId: draft.pendingId === pending ? null : draft.pendingId,
      attemptedId: null,
    });
    emit(draft.pendingId ? "syncing" : "synced");
  }

  function refresh(discard?: { pendingId: string | null }) {
    tail = tail.then(() => reconcile(discard)).catch(() => emit("error"));
    return tail;
  }

  return {
    start: () => {
      try {
        draft = connection.readDraft();
      } catch {
        draftIssue = true;
      }
      return refresh();
    },
    stage: (plans: Scenario[]) => {
      if (!draft) return;
      persist({ ...draft, plans, pendingId: createId() });
      emit(conflicted ? "conflict" : "syncing");
      if (!conflicted) void refresh();
    },
    refresh: () => refresh(),
    discardAndRefresh: () => refresh({ pendingId: draft?.pendingId ?? null }),
  };
}
