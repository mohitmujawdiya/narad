import { Topbar } from "@/components/layout/topbar";
import { StackedCards } from "@/components/queue/stacked-cards";

export default function Page() {
  return (
    <>
      <Topbar title="Queue" />
      <StackedCards />
    </>
  );
}
