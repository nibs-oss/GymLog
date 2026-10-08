import { createClient as createServerClient } from "@/utils/supabase/server";
import { phIsoDate } from "@/lib/fitness";
import { planCalendar } from "@/lib/ics";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Subscribable weekly plan: /api/calendar/<token>.ics (no login; the token is
 * private). An unknown or reset token gets an empty calendar, so an old link
 * simply shows nothing and doesn't reveal whether the token ever existed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!UUID.test(token)) return new Response("Not found", { status: 404 });

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("calendar_plan", { p_token: token });
  if (error) return new Response("Calendar unavailable", { status: 503 });

  const days = ((data ?? []) as { weekday: number; routine_name: string }[]).map((d) => ({
    weekday: d.weekday,
    routineName: d.routine_name,
  }));
  return new Response(planCalendar(days, { token, today: phIsoDate(), now: new Date() }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="gymlog-plan.ics"',
      "Cache-Control": "no-store",
    },
  });
}
