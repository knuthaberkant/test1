import { getDb } from "./db";
import type { SessionUser } from "./auth";
export { formatDate, formatDateTime, formatDuration, SOURCE_LABELS } from "./format";

export type Item = {
  id: number;
  section_id: number;
  title: string;
  description: string | null;
  ai_description: string | null;
  position: number;
};
export type Section = {
  id: number;
  checklist_id: number;
  title: string;
  description: string | null;
  ai_description: string | null;
  position: number;
  items: Item[];
};
export type Checklist = {
  id: number;
  name: string;
  description: string | null;
  active: number;
  created_at: string;
  updated_at: string;
};
export type ChecklistFull = Checklist & { sections: Section[] };

export type Run = {
  id: number;
  checklist_id: number;
  user_id: number;
  status: "in_progress" | "completed" | "signed";
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  summary: string | null;
  summary_source: string | null;
  summary_original: string | null;
  signature: string | null;
  signed_at: string | null;
  signer_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy: number | null;
  location_label: string | null;
  location_status: string | null;
  report_json: string | null;
};
export type RunItem = {
  item_id: number;
  checked: number;
  checked_at: string | null;
  comment: string | null;
  comment_source: string | null;
  comment_original: string | null;
};

export function listChecklists(includeInactive = true): (Checklist & { item_count: number; section_count: number })[] {
  return getDb()
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM sections s WHERE s.checklist_id = c.id AND s.deleted_at IS NULL) AS section_count,
         (SELECT COUNT(*) FROM items i JOIN sections s ON s.id = i.section_id
            WHERE s.checklist_id = c.id AND s.deleted_at IS NULL AND i.deleted_at IS NULL) AS item_count
       FROM checklists c WHERE c.deleted_at IS NULL ${includeInactive ? "" : "AND c.active = 1"}
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all() as (Checklist & { item_count: number; section_count: number })[];
}

export function getChecklist(id: number): ChecklistFull | null {
  const db = getDb();
  const checklist = db.prepare("SELECT * FROM checklists WHERE id = ? AND deleted_at IS NULL").get(id) as
    | Checklist
    | undefined;
  if (!checklist) return null;
  const sections = db
    .prepare("SELECT * FROM sections WHERE checklist_id = ? AND deleted_at IS NULL ORDER BY position, id")
    .all(id) as Section[];
  const items = db
    .prepare(
      `SELECT i.* FROM items i JOIN sections s ON s.id = i.section_id
       WHERE s.checklist_id = ? AND i.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY i.position, i.id`,
    )
    .all(id) as Item[];
  for (const s of sections) s.items = items.filter((i) => i.section_id === s.id);
  return { ...checklist, sections };
}

/** Checklists a user may start, honoring the "only default checklist" switch. */
export function checklistsForUser(user: SessionUser) {
  const all = listChecklists(false);
  if (user.locked_to_default && user.role !== "admin") {
    return all.filter((c) => c.id === user.default_checklist_id);
  }
  return all;
}

export function getRun(id: number): Run | null {
  return (getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined) ?? null;
}

export function getRunItems(runId: number): RunItem[] {
  return getDb().prepare("SELECT * FROM run_items WHERE run_id = ?").all(runId) as RunItem[];
}

export function canAccessRun(user: SessionUser, run: Run) {
  return user.role === "admin" || run.user_id === user.id;
}

/** Frozen copy of everything the report shows, so later checklist edits don't change signed reports. */
export type ReportSnapshot = {
  checklistName: string;
  userName: string;
  userEmail: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sections: {
    title: string;
    items: {
      title: string;
      checked: boolean;
      checkedAt: string | null;
      comment: string | null;
      commentSource: string | null;
    }[];
  }[];
};

export function buildSnapshot(run: Run): ReportSnapshot {
  const db = getDb();
  const checklist = db.prepare("SELECT name FROM checklists WHERE id = ?").get(run.checklist_id) as { name: string };
  const user = db.prepare("SELECT name, email FROM users WHERE id = ?").get(run.user_id) as {
    name: string;
    email: string;
  };
  const full = getChecklist(run.checklist_id);
  const state = new Map(getRunItems(run.id).map((r) => [r.item_id, r]));
  const completedAt = run.completed_at ?? new Date().toISOString();
  return {
    checklistName: checklist.name,
    userName: user.name,
    userEmail: user.email,
    startedAt: run.started_at,
    completedAt,
    durationMs: new Date(completedAt).getTime() - new Date(run.started_at).getTime(),
    sections: (full?.sections ?? []).map((s) => ({
      title: s.title,
      items: s.items.map((i) => {
        const r = state.get(i.id);
        return {
          title: i.title,
          checked: Boolean(r?.checked),
          checkedAt: r?.checked_at ?? null,
          comment: r?.comment ?? null,
          commentSource: r?.comment_source ?? null,
        };
      }),
    })),
  };
}

export function snapshotFor(run: Run): ReportSnapshot {
  return run.report_json ? (JSON.parse(run.report_json) as ReportSnapshot) : buildSnapshot(run);
}

