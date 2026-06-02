"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "calendar" | "search" | "insight";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/calendar", label: "カレンダー", icon: "calendar" },
  { href: "/search", label: "検索", icon: "search" },
  { href: "/review", label: "振り返り", icon: "insight" },
];

function Icon({ name }: { name: IconName }) {
  const p = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
  };
  switch (name) {
    case "home":
      return (
        <svg {...p}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.6-3.6" />
        </svg>
      );
    case "insight":
      return (
        <svg {...p}>
          <path d="M5 20V12M12 20V4M19 20v-5" />
        </svg>
      );
  }
}

export default function BottomNav() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/record")) return null;

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-md justify-around border-t border-slate-200/80 bg-white/90 backdrop-blur">
      {ITEMS.map((it) => {
        const active =
          it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
              active ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            <Icon name={it.icon} />
            <span className={active ? "font-semibold" : ""}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
