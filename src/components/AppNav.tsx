"use client";

import { ChartBarBig, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Bar race", icon: ChartBarBig },
  { href: "/graph", label: "Friend graph", icon: Waypoints },
];

/** Switch between the bar-race and friend-graph workspaces. */
export function AppNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="bg-muted inline-flex rounded-lg p-1 text-sm">
      {LINKS.map(({ href, label, icon: Icon }) => (
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
        </Link>
      ))}
    </nav>
  );
}
