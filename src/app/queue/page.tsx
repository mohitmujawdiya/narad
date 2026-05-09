import { Topbar } from "@/components/layout/topbar";

export default function Page() {
  return (
    <>
      <Topbar title="Queue" />
      <div className="p-6 text-muted-foreground">Coming in upcoming task.</div>
    </>
  );
}
