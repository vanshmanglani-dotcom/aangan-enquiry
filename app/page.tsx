import { db } from "@/lib/supabase";
import Dashboard from "./Dashboard";
import HeroCursor from "./HeroCursor";
import Tour from "./Tour";
export const dynamic = "force-dynamic";

export default async function Page() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await db().from("calls").select("*").gte("created_at", since).order("created_at", { ascending: false });
  return (<><Dashboard real={data || []} now={Date.now()} /><HeroCursor /><Tour /></>);
}
