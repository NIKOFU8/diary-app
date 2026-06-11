// Export diary entries from Supabase for brain sync.
// Usage: node scripts/export-entries.mjs [--since YYYY-MM-DD]

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const sinceIdx = process.argv.indexOf("--since");
const since = sinceIdx !== -1 ? process.argv[sinceIdx + 1] : null;

function loadEnv() {
  try {
    const content = readFileSync(join(rootDir, ".env.local"), "utf-8");
    return Object.fromEntries(
      content
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#") && l.trim())
        .map((l) => {
          const idx = l.indexOf("=");
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiKey = serviceKey || anonKey;

if (!supabaseUrl || !apiKey) {
  console.error(
    JSON.stringify({
      error:
        "Supabase が未設定です。diary-app/.env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY（または NEXT_PUBLIC_SUPABASE_ANON_KEY）を設定してください。",
    }),
  );
  process.exit(1);
}

let endpoint = `${supabaseUrl}/rest/v1/entries?select=id,created_at,weather,condition,body&order=created_at.asc`;
if (since) {
  endpoint += `&created_at=gte.${since}T00:00:00.000Z`;
}

const res = await fetch(endpoint, {
  headers: {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  },
});

if (!res.ok) {
  const text = await res.text();
  console.error(
    JSON.stringify({ error: `Supabase API エラー ${res.status}: ${text}` }),
  );
  process.exit(1);
}

const entries = await res.json();
console.log(
  JSON.stringify({
    entries,
    exportedAt: new Date().toISOString(),
    since: since ?? null,
    count: entries.length,
  }),
);
