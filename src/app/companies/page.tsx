import { Topbar } from "@/components/layout/topbar";
import { Kanban } from "@/components/companies/kanban";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CompaniesPage() {
  return (
    <>
      <Topbar
        title="Companies"
        actions={
          <Button asChild size="sm">
            <Link href="/companies/new">+ Add company</Link>
          </Button>
        }
      />
      <Kanban />
    </>
  );
}
