// Supabase-backed store. Activated automatically when NEXT_PUBLIC_SUPABASE_URL
// and NEXT_PUBLIC_SUPABASE_ANON_KEY are set. Requires the schema in
// `supabase/schema.sql` and (for multi-device / "本人のみ") Supabase Auth.

import type { DiaryEntry, NewEntryInput, Weather, Condition } from "@/lib/types";
import type { DiaryStore } from "./index";
import { getSupabaseClient } from "@/lib/supabase/client";

const BUCKET = "diary-photos";

interface Row {
  id: string;
  created_at: string;
  weather: Weather;
  condition: number;
  body: string;
  photo_url: string | null;
}

function toEntry(r: Row): DiaryEntry {
  return {
    id: r.id,
    createdAt: r.created_at,
    weather: r.weather,
    condition: r.condition as Condition,
    body: r.body,
    photoUrl: r.photo_url,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function createSupabaseStore(): DiaryStore {
  const sb = getSupabaseClient();

  async function uploadPhoto(dataUrl: string): Promise<string> {
    const blob = dataUrlToBlob(dataUrl);
    const ext = (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  return {
    async create(input: NewEntryInput) {
      const photoUrl = input.photoDataUrl ? await uploadPhoto(input.photoDataUrl) : null;
      const { data, error } = await sb
        .from("entries")
        .insert({
          created_at: input.createdAt ?? new Date().toISOString(),
          weather: input.weather,
          condition: input.condition,
          body: input.body,
          photo_url: photoUrl,
        })
        .select()
        .single();
      if (error) throw error;
      return toEntry(data as Row);
    },

    async listAll() {
      const { data, error } = await sb
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(toEntry);
    },

    async listBetween(startISO, endISO) {
      const { data, error } = await sb
        .from("entries")
        .select("*")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(toEntry);
    },

    async get(id) {
      const { data, error } = await sb
        .from("entries")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? toEntry(data as Row) : null;
    },

    async remove(id) {
      const { error } = await sb.from("entries").delete().eq("id", id);
      if (error) throw error;
    },

    async search(query) {
      const q = query.trim();
      if (!q) return [];
      const { data, error } = await sb
        .from("entries")
        .select("*")
        .ilike("body", `%${q}%`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(toEntry);
    },
  };
}
