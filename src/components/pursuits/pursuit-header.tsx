"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, ExternalLink } from "lucide-react";
import type { PursuitStatus, PursuitWithDecodedJson } from "@/server/types/pursuit";

const STATUSES: PursuitStatus[] = [
  "Saved",
  "Researched",
  "Targeting",
  "Active",
  "Replied",
  "Interview",
  "Offer",
  "Rejected",
  "Discarded",
];

export function PursuitHeader({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const setStatus = trpc.pursuits.setStatus.useMutation({
    onMutate: async ({ id, status }) => {
      // Optimistic — flip status in the byId cache + the kanban list cache so
      // the change is visible instantly here and on the back-nav.
      await Promise.all([
        utils.pursuits.byId.cancel({ id }),
        utils.pursuits.list.cancel(),
      ]);
      const previousById = utils.pursuits.byId.getData({ id });
      const previousList = utils.pursuits.list.getData();
      if (previousById) {
        utils.pursuits.byId.setData({ id }, { ...previousById, status });
      }
      utils.pursuits.list.setData(undefined, (old) =>
        old?.map((p) => (p.id === id ? { ...p, status } : p)),
      );
      return { previousById, previousList };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previousById) {
        utils.pursuits.byId.setData({ id: pursuit.id }, ctx.previousById);
      }
      if (ctx?.previousList) {
        utils.pursuits.list.setData(undefined, ctx.previousList);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
      void utils.pursuits.list.invalidate();
    },
  });

  const remove = trpc.pursuits.remove.useMutation({
    onSuccess: () => {
      toast.success("Pursuit removed");
      // Drop it from the kanban list cache so back-nav shows it gone.
      utils.pursuits.list.setData(undefined, (old) =>
        old?.filter((p) => p.id !== pursuit.id),
      );
      router.push("/pursuits");
    },
    onError: (e) => toast.error(e.message),
  });

  const isJob = pursuit.type === "job";

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-semibold truncate">{pursuit.companyName}</h2>
          <Badge variant="secondary" className="shrink-0">
            {isJob ? "Job" : "Company"}
          </Badge>
          {pursuit.fitScore != null && (
            <Badge variant="outline" className="shrink-0">
              Fit: {pursuit.fitScore}/10
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          {isJob && pursuit.jdTitle && (
            <span className="truncate">{pursuit.jdTitle}</span>
          )}
          {pursuit.companyDomain && (
            <span className="truncate">
              {isJob && pursuit.jdTitle ? "· " : ""}
              {pursuit.companyDomain}
            </span>
          )}
          {pursuit.pastedUrl && (
            <a
              href={pursuit.pastedUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              source
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Select
          value={pursuit.status}
          onValueChange={(v) =>
            setStatus.mutate({ id: pursuit.id, status: v as PursuitStatus })
          }
          disabled={setStatus.isPending}
        >
          <SelectTrigger size="sm" className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`Remove "${pursuit.companyName}"? This can't be undone.`)) {
              remove.mutate({ id: pursuit.id });
            }
          }}
        >
          <Trash2 className="size-4" />
          {remove.isPending ? "Removing…" : "Remove"}
        </Button>
      </div>
    </header>
  );
}
