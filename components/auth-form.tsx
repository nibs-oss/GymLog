"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { PasswordInput } from "@/components/password-input";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const isLogin = mode === "login";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Send the user back to this app's login page after they confirm.
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // If email confirmation is enabled, there's no session yet.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.push("/");
        router.refresh();
      } else {
        setNotice(
          "Account created. Check your email to confirm your address, then log in."
        );
        setLoading(false);
      }
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/60 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isLogin ? "Log in to GymLog" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        {isLogin
          ? "Pick up where you left off."
          : "Start tracking your training."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-300">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-600 focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-sm font-medium text-slate-300">
            Password
            {isLogin && (
              <Link href="/forgot-password" className="text-xs font-normal text-accent hover:underline">
                Forgot password?
              </Link>
            )}
          </span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : isLogin
              ? "Log in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        {isLogin ? (
          <>
            No account?{" "}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}