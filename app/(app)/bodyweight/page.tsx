import { createClient as createServerClient } from "@/utils/supabase/server";
import { getUserSettings } from "@/lib/settings";
import BodyweightClient from "./BodyweightClient";

export default async function BodyweightPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: entries, error }, settings] = await Promise.all([
    supabase
      .from("body_weights")
      .select("id, date, weight")
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
    getUserSettings(supabase, user.id),
  ]);

  return (
    <BodyweightClient
      units={settings.units}
      setupNeeded={!!error}
      entries={(entries ?? []).map((e) => ({ id: e.id as string, date: e.date as string, weight: Number(e.weight) }))}
    />
  );
}
