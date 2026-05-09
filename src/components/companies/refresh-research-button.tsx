"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function RefreshResearchButton({ companyId }: { companyId: string }) {
  const utils = trpc.useUtils();
  const refresh = trpc.research.refresh.useMutation({
    onSuccess: () => {
      toast.success("Research refreshed");
      utils.research.byCompanyId.invalidate({ companyId });
      utils.companies.byId.invalidate({ id: companyId });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => refresh.mutate({ companyId })}
      disabled={refresh.isPending}
    >
      <RefreshCw className={refresh.isPending ? "size-4 animate-spin" : "size-4"} />
      {refresh.isPending ? "Refreshing…" : "Refresh research"}
    </Button>
  );
}
