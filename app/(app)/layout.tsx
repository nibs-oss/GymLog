import { AppNav } from "@/components/app-nav";
import { PendingSync } from "@/components/pending-sync";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNav />
      {/* Bottom padding leaves room for the phone tab bar + iPhone home indicator */}
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:py-8">
        <PendingSync />
        {children}
      </main>
    </>
  );
}
