import { Topbar } from "@/components/layout/topbar";
import { Kanban } from "@/components/companies/kanban";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CompaniesPage() {
  return (
    <>
      <Topbar title="Companies" />
      <div className="flex justify-end px-6 pt-3">
        <Button asChild>
          <Link href="/companies/new">+ Add company</Link>
        </Button>
      </div>
      <Kanban />
    </>
  );
}
