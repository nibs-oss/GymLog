"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-center px-4">
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
        </div>
      </nav>
    </header>
  );
}