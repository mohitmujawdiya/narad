"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { PursuitDetail } from "@/components/pursuits/pursuit-detail";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const pursuit = trpc.pursuits.byId.useQuery({ id });

  if (pursuit.isLoading || pursuit.isPending) {
    return (
      <>
        <Topbar title="Pursuit" />
        <div className="p-6 max-w-5xl mx-auto">
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        </div>
      </>
    );
  }
  if (pursuit.error || !pursuit.data) {
    return (
      <>
        <Topbar title="Pursuit not found" />
        <div className="p-6 max-w-5xl mx-auto text-muted-foreground">
          {pursuit.error?.message ?? `No pursuit with id ${id}.`}
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={pursuit.data.companyName} />
      <PursuitDetail pursuit={pursuit.data} />
    </>
  );
}
