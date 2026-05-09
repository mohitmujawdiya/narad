"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { CompanyTabs } from "@/components/companies/company-tabs";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const company = trpc.companies.byId.useQuery({ id });

  if (company.isLoading || company.isPending) {
    return (
      <>
        <Topbar title="Loading…" />
        <div className="p-6 space-y-3">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-32 w-full bg-muted/60 rounded animate-pulse" />
        </div>
      </>
    );
  }

  if (company.error || !company.data) {
    return (
      <>
        <Topbar title="Not found" />
        <div className="p-6 text-sm text-muted-foreground">
          {company.error?.message ?? "Company not found."}
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={company.data.name} />
      <CompanyTabs company={company.data} />
    </>
  );
}
