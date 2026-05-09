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
    <aside className="w-56 shrink-0 border-r bg-muted/30 h-screen sticky top-0 flex flex-col">
      <div className="px-4 py-5 border-b">
        <Link href="/" className="font-semibold text-lg">Narad</Link>
        <p className="text-xs text-muted-foreground">Outbound engine</p>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                active ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
