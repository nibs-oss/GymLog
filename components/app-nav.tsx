"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

const links = [
  { href: "/", label: "Home" },
  { href: "/routines", label: "Routines" },
  { href: "/history", label: "History" },
  { href: "/progress", label: "Progress" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-base font-bold tracking-tight">
          Gym<span className="text-accent">Log</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "text-accent"
                    : "text-zinc-400 hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="ml-2 border-l border-white/10 pl-2">
            <LogoutButton />
          </div>
        </div>
      </nav>
    </header>
  );
}