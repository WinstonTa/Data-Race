"use client";

import { Building2, ChartBarBig, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Bar race", icon: ChartBarBig },
  { href: "/graph", label: "Friend graph", icon: Waypoints },
  { href: "/city", label: "City 3D", icon: Building2, experimental: true },
];

/** Switch between the bar-race, friend-graph and city workspaces. */
export function AppNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="bg-muted inline-flex rounded-lg p-1 text-sm">
      {LINKS.map(({ href, label, icon: Icon, experimental }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "text-muted-foreground flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors",
            active(href)
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
          {experimental ? (
            <span className="rounded bg-amber-500/15 px-1 text-[10px] font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
              Beta
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
