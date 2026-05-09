"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Inbox,
  Building2,
  ListOrdered,
  Sparkles,
  Settings,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/queue", label: "Queue", icon: ListTodo },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/sources", label: "Sources", icon: Sparkles },
  { href: "/sequences", label: "Sequences", icon: ListOrdered },
  { href: "/funnel", label: "Funnel", icon: PieChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen sticky top-0 flex flex-col">
      <div className="px-4 py-5 border-b border-sidebar-border">
        <Link href="/" className="font-semibold text-lg tracking-tight">Narad</Link>
        <p className="text-xs text-muted-foreground">Outbound engine</p>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border">
        <ThemeToggle />
      </div>
    </aside>
  );
}
