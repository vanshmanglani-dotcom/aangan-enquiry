export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { readFileSync } from "fs";
import path from "path";

// One-time, idempotent: creates the `calls` table (CREATE ... IF NOT EXISTS). Safe to re-run.
export async function GET() {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: "POSTGRES_URL missing" }, { status: 500 });
  const sql = postgres(url, { ssl: "require", max: 1 });
  try {
    await sql.unsafe(readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8"));
    const [{ count }] = await sql`select count(*)::int as count from calls`;
    return NextResponse.json({ ok: true, table: "calls", rows: count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await sql.end();
  }
}
