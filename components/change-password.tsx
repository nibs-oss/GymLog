"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PasswordInput } from "@/components/password-input";

/** Profile card: change password while logged in (current password required). */
export function ChangePassword({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (next !== confirm) return setError("New passwords don't match.");
    if (next === current) return setError("Choose a password different from your current one.");
    setBusy(true);

    const supabase = createClient();
    // Confirm it's really the account owner before changing the password
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (authErr) {
      setBusy(false);
      return setError("Current password is incorrect.");
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updErr) return setError(updErr.message);

    reset();
    setOpen(false);
    setDone(true);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">Password</h2>
          <p className="mt-1 text-sm text-slate-400">
            {done ? "✓ Password changed." : "Change the password you use to log in."}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(false);
            }}
            className="shrink-0 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5"
          >
            Change password
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">Current password</span>
            <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">New password</span>
            <PasswordInput value={next} onChange={setNext} autoComplete="new-password" minLength={6} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">Confirm new password</span>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={6} />
          </label>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving…" : "Update password"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
