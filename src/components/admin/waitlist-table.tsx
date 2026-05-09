"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type WaitlistEntry = {
  id: string;
  email: string;
  source: string;
  status: string;
  createdAt: Date;
};

type WaitlistTableProps = {
  entries: WaitlistEntry[];
};

function formatRelativeDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function WaitlistTable({ entries: initialEntries }: WaitlistTableProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pending = entries.filter((e) => e.status === "pending").length;
  const invited = entries.filter((e) => e.status === "invited").length;

  async function handleInvite(entry: WaitlistEntry) {
    setLoadingId(entry.id);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, email: entry.email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite");
      }

      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: "invited" } : e)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span>{pending} pending</span>
        <span>&middot;</span>
        <span>{invited} invited</span>
        <span>&middot;</span>
        <span>{entries.length} total</span>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Signed up</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 text-sm">{entry.email}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatRelativeDate(entry.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {entry.status === "invited" ? (
                    <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400">
                      Invited
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {entry.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === entry.id}
                      onClick={() => handleInvite(entry)}
                    >
                      {loadingId === entry.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Invite"
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No waitlist entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
