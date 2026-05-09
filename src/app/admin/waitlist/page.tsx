import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { WaitlistTable } from "@/components/admin/waitlist-table";

export const dynamic = "force-dynamic";

export default async function AdminWaitlistPage() {
  const { userId } = await auth();

  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    notFound();
  }

  const entries = await db.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">Waitlist</h1>
      <WaitlistTable entries={entries} />
    </div>
  );
}
