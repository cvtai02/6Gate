"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/providers", label: "Providers" },
  { href: "/groups", label: "Groups" },
  { href: "/7router", label: "7router" },
  { href: "/usecases", label: "Use Cases" },
  { href: "/jobs", label: "Jobs" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--muted)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <span className="text-xl font-bold tracking-tight text-white">6Gate</span>
        <p className="text-xs text-gray-500 mt-0.5">Social Gateway</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600/20 text-indigo-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-[var(--border)]">
        <p className="text-xs text-gray-600">localhost:20129</p>
      </div>
    </aside>
  );
}
