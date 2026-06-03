"use client";

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getTaskStore } from "@/lib/tasks";
import type { Task } from "@/lib/tasks";
import NotificationToggle from "@/components/NotificationToggle";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

const NOTIFY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "通知なし" },
  { value: 0, label: "当日" },
  { value: 1, label: "1日前" },
  { value: 3, label: "3日前" },
  { value: 7, label: "1週間前" },
];

function mdLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

interface DragHandleProps {
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
}

/** useSortable をラップし、行のJSXは呼び出し側で組み立てられるようにする（状態へのアクセスを保つため）。 */
function Sortable({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (p: DragHandleProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 10, position: "relative" } : {}),
  };
  return (
    <>
      {children({
        setNodeRef,
        style,
        attributes,
        listeners,
        isDragging,
      })}
    </>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [eContent, setEContent] = useState("");
  const [eDue, setEDue] = useState("");
  const [eNotify, setENotify] = useState<number | null>(null);

  // モバイルの長押し→ドラッグ、PCのマウス、キーボード操作に対応
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reload = async () => {
    const s = await getTaskStore();
    setTasks(await s.list());
  };

  useEffect(() => {
    reload().catch(() => setTasks([]));
  }, []);

  const add = async () => {
    const content = newContent.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const s = await getTaskStore();
      await s.create({ content });
      setNewContent("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async (t: Task) => {
    const s = await getTaskStore();
    await s.update(t.id, { done: !t.done });
    await reload();
  };

  const openEditor = (t: Task) => {
    setEditingId(t.id);
    setEContent(t.content);
    setEDue(t.dueDate ?? "");
    setENotify(t.notifyDaysBefore);
  };

  const saveEditor = async () => {
    const content = eContent.trim();
    if (!editingId || !content) return;
    const s = await getTaskStore();
    await s.update(editingId, { content, dueDate: eDue || null, notifyDaysBefore: eNotify });
    setEditingId(null);
    await reload();
  };

  const removeTask = async (id: string) => {
    const s = await getTaskStore();
    await s.remove(id);
    if (editingId === id) setEditingId(null);
    await reload();
  };

  const clearDone = async () => {
    if (!window.confirm("完了済みのタスクをすべて削除しますか？")) return;
    const s = await getTaskStore();
    await s.removeCompleted();
    await reload();
  };

  // 「期日なし」グループ内のドラッグ＆ドロップ並び替え
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !tasks) return;
    const undated = tasks.filter((t) => !t.done && !t.dueDate);
    const rest = tasks.filter((t) => t.done || !!t.dueDate); // [期日あり…, 完了…] の順は維持される
    const ids = undated.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const newUndated = arrayMove(undated, oldIndex, newIndex);
    // 楽観的更新（即座に並びを反映）
    setTasks([...newUndated, ...rest]);
    // 永続化。失敗したらサーバ状態へ戻す
    getTaskStore()
      .then((s) => s.reorder(newUndated.map((t) => t.id)))
      .catch(() => reload());
  };

  const renderCard = (t: Task, drag?: DragHandleProps): ReactNode => {
    // 未完了かつ「今日」または「過去」の期日 → カード全体を薄い警告色で強調（完了済みは対象外）
    const warn = !t.done && !!t.dueDate && t.dueDate <= todayKey();
    if (editingId === t.id) {
      return (
        <div
          key={t.id}
          ref={drag?.setNodeRef}
          style={drag?.style}
          className="rounded-2xl border border-indigo-200 bg-white p-4"
        >
          <input
            value={eContent}
            onChange={(e) => setEContent(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400"
          />
          <div className="mt-3 flex items-center gap-2">
            <label className="w-14 flex-none text-xs text-slate-500">期日</label>
            <input
              type="date"
              value={eDue}
              onChange={(e) => setEDue(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            {eDue ? (
              <button
                type="button"
                onClick={() => setEDue("")}
                className="flex-none text-xs text-slate-400 underline"
              >
                クリア
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="w-14 flex-none text-xs text-slate-500">通知</label>
            <select
              value={eNotify === null ? "" : String(eNotify)}
              onChange={(e) => setENotify(e.target.value === "" ? null : Number(e.target.value))}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              {NOTIFY_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value === null ? "" : String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => removeTask(t.id)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600"
            >
              削除
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={saveEditor}
              disabled={!eContent.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={t.id}
        ref={drag?.setNodeRef}
        style={drag?.style}
        {...(drag?.attributes ?? {})}
        {...(drag?.listeners ?? {})}
        className={`flex items-start gap-3 rounded-2xl border p-3.5 ${
          warn ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"
        } ${drag ? "select-none touch-manipulation" : ""} ${
          drag?.isDragging ? "opacity-80 shadow-lg ring-1 ring-indigo-200" : ""
        }`}
      >
        {drag ? (
          <span className="mt-0.5 flex-none cursor-grab text-slate-300" aria-hidden>
            <GripIcon />
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => toggleDone(t)}
          aria-label={t.done ? "未完了に戻す" : "完了にする"}
          className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
            t.done ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
          }`}
        >
          {t.done ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <path d="m5 12 5 5L20 6" />
            </svg>
          ) : null}
        </button>
        <button type="button" onClick={() => openEditor(t)} className="min-w-0 flex-1 text-left">
          <span
            className={`block break-words text-sm ${
              t.done ? "text-slate-400 line-through" : "text-slate-800"
            }`}
          >
            {t.content}
          </span>
          {t.dueDate || t.notifyDaysBefore !== null ? (
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
              {t.dueDate ? (
                <span
                  className={
                    // 未完了かつ「今日」または「過去」の期日は警告色で強調（完了済みは対象外）
                    !t.done && t.dueDate <= todayKey() ? "font-semibold text-rose-600" : ""
                  }
                >
                  期日 {mdLabel(t.dueDate)}
                </span>
              ) : null}
              {t.notifyDaysBefore !== null ? (
                <span>
                  {t.notifyDaysBefore === 0 ? "当日通知" : `${t.notifyDaysBefore}日前通知`}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      </div>
    );
  };

  // 表示グループ（compareTasks により tasks は [期日なし…, 期日あり…, 完了…] の順）
  const undated = (tasks ?? []).filter((t) => !t.done && !t.dueDate);
  const dated = (tasks ?? []).filter((t) => !t.done && !!t.dueDate);
  const done = (tasks ?? []).filter((t) => t.done);

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">タスク</h1>
      <p className="mt-1 text-xs text-slate-400">
        やるべきことを手動で追加して管理できます
      </p>

      <NotificationToggle />

      <div className="mt-3 flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="新しいタスクを入力"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={add}
          disabled={!newContent.trim() || busy}
          className="flex-none rounded-2xl bg-indigo-600 px-5 font-bold text-white active:bg-indigo-700 disabled:opacity-50"
        >
          追加
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {tasks === null ? (
          <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
            タスクはまだありません
          </div>
        ) : (
          <>
            {/* 期日なし: 長押し（ロングタップ）でドラッグして並び替え可能 */}
            {undated.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={undated.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {undated.map((t) => (
                    <Sortable key={t.id} id={t.id} disabled={editingId === t.id}>
                      {(drag) => renderCard(t, drag)}
                    </Sortable>
                  ))}
                </SortableContext>
              </DndContext>
            ) : null}

            {/* 期日あり（期日昇順・並び替え対象外） */}
            {dated.map((t) => renderCard(t))}

            {/* 完了済み */}
            {done.length > 0 ? (
              <div className="mb-1 mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">完了済み</span>
                <button
                  type="button"
                  onClick={clearDone}
                  className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 active:bg-rose-50"
                >
                  完了済みを削除
                </button>
              </div>
            ) : null}
            {done.map((t) => (
              <Fragment key={t.id}>{renderCard(t)}</Fragment>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
