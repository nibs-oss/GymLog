import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

/**
 * Landing point for links in Supabase emails (password reset).
 * Turns the link's one-time code into a signed-in session, then continues to `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") ?? "/";
  // Only allow same-site paths so the link can't bounce users elsewhere
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createServerClient();
  let ok = false;
  if (code) {
    // Default (PKCE) links. Works in the browser that requested the reset.
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    // Links from a customised email template using {{ .TokenHash }}. Work on any device.
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/forgot-password?error=link", url.origin));
}
