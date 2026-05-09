import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, email } = (await req.json()) as { id: string; email: string };

  if (!id || !email) {
    return NextResponse.json(
      { error: "id and email are required" },
      { status: 400 },
    );
  }

  const clerk = await clerkClient();

  await clerk.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: "/",
    ignoreExisting: true,
  });

  await db.waitlistEntry.update({
    where: { id },
    data: { status: "invited" },
  });

  return NextResponse.json({ success: true });
}
