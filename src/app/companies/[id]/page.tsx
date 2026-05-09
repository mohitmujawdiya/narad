"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { CompanyTabs } from "@/components/companies/company-tabs";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const company = trpc.companies.byId.useQuery({ id });

  if (company.isLoading) return null;
  if (!company.data) return <div className="p-6">Not found.</div>;

  return (
    <>
      <Topbar title={company.data.name} />
      <CompanyTabs company={company.data} />
    </>
  );
}
