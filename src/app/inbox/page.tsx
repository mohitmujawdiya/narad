import { Topbar } from "@/components/layout/topbar";
import { ReplyList } from "@/components/inbox/reply-list";

export default function Page() {
  return (
    <>
      <Topbar title="Inbox" />
      <ReplyList />
    </>
  );
}
