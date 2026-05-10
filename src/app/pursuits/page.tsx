import { Topbar } from "@/components/layout/topbar";
import { PursuitsKanban } from "@/components/pursuits/kanban";

export default function PursuitsPage() {
  return (
    <>
      <Topbar title="Pursuits" />
      <PursuitsKanban />
    </>
  );
}
