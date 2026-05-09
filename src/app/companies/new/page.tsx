import { Topbar } from "@/components/layout/topbar";
import { AddViaUrl } from "@/components/companies/add-via-url";

export default function Page() {
  return (
    <>
      <Topbar title="Add company" />
      <div className="p-6">
        <AddViaUrl />
        <p className="text-xs text-muted-foreground mt-12">
          Bulk paste (YC batch URLs, Wellfound search URLs, CSVs) lands in Plan A2.
        </p>
      </div>
    </>
  );
}
