import { Topbar } from "@/components/layout/topbar";
import { QueueSummaryCard } from "@/components/dashboard/queue-summary-card";
import { FunnelSnapshotCard } from "@/components/dashboard/funnel-snapshot-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";

export default function Page() {
  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
        <QueueSummaryCard />
        <FunnelSnapshotCard />
        <QuickActionsCard />
      </div>
    </>
  );
}
