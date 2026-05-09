import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const PLAYGROUND_PROJECT_SLUG =
  process.env.PLAYGROUND_PROJECT_SLUG ?? "playground";
const PLAYGROUND_PROJECT_NAME = "Playground";
const DEMO_USER_ID = process.env.DEMO_USER_ID;

export default async function PlaygroundLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  // Authenticated users should use their own workspace, not the playground
  const { userId } = await auth();
  if (userId) {
    redirect("/");
  }

  if (!DEMO_USER_ID) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Playground Not Available</h1>
          <p className="mt-2 text-muted-foreground">
            Server is missing the DEMO_USER_ID env var.
          </p>
        </div>
      </div>
    );
  }

  // Find or auto-create the playground project under the demo user.
  // This bootstraps the playground with no manual DB setup.
  let project = await db.project.findFirst({
    where: { slug: PLAYGROUND_PROJECT_SLUG, userId: DEMO_USER_ID },
    select: { id: true, slug: true, name: true, deletedAt: true },
  });

  if (project?.deletedAt) {
    // Soft-deleted — undelete so the playground stays usable
    project = await db.project.update({
      where: { id: project.id },
      data: { deletedAt: null },
      select: { id: true, slug: true, name: true, deletedAt: true },
    });
  }

  if (!project) {
    project = await db.project.create({
      data: {
        slug: PLAYGROUND_PROJECT_SLUG,
        name: PLAYGROUND_PROJECT_NAME,
        userId: DEMO_USER_ID,
      },
      select: { id: true, slug: true, name: true, deletedAt: true },
    });
  }

  return (
    <WorkspaceShell
      projectId={project.id}
      projectName={project.name}
      projectSlug={PLAYGROUND_PROJECT_SLUG}
      isPlayground
    />
  );
}
