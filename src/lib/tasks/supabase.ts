import type { Task, TaskStore, TaskSource } from "./index";
import { compareTasks } from "./index";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Row {
  id: string;
  created_at: string;
  content: string;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  notify_days_before: number | null;
  source: TaskSource;
  entry_id: string | null;
}

function toTask(r: Row): Task {
  return {
    id: r.id,
    createdAt: r.created_at,
    content: r.content,
    done: r.done,
    doneAt: r.done_at,
    dueDate: r.due_date,
    notifyDaysBefore: r.notify_days_before,
    source: r.source,
    entryId: r.entry_id,
  };
}

export function createSupabaseTaskStore(): TaskStore {
  const sb = getSupabaseClient();
  return {
    async list() {
      const { data, error } = await sb.from("tasks").select("*");
      if (error) throw error;
      return (data as Row[]).map(toTask).sort(compareTasks);
    },

    async create(input) {
      const { data, error } = await sb
        .from("tasks")
        .insert({
          content: input.content,
          due_date: input.dueDate ?? null,
          notify_days_before: input.notifyDaysBefore ?? null,
          source: input.source ?? "manual",
          entry_id: input.entryId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return toTask(data as Row);
    },

    async update(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.content !== undefined) row.content = patch.content;
      if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
      if (patch.notifyDaysBefore !== undefined) row.notify_days_before = patch.notifyDaysBefore;
      if (patch.done !== undefined) {
        row.done = patch.done;
        row.done_at = patch.done ? new Date().toISOString() : null;
        // 期日や条件を変える時は notified_at をリセットして再通知できるようにする想定（通知はフェーズ5）
      }
      const { data, error } = await sb
        .from("tasks")
        .update(row)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return toTask(data as Row);
    },

    async remove(id) {
      const { error } = await sb.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },

    async removeCompleted() {
      const { error } = await sb.from("tasks").delete().eq("done", true);
      if (error) throw error;
    },
  };
}
