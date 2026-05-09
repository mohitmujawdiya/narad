import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const DEMO_PROJECT_SLUG = process.env.DEMO_PROJECT_SLUG ?? "demo";

export default async function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authenticated users should use their own workspace, not the demo
  const { userId } = await auth();
  if (userId) {
    redirect("/");
  }

  const project = await db.project.findUnique({
    where: { slug: DEMO_PROJECT_SLUG },
    select: { id: true, slug: true, name: true, deletedAt: true },
  });

  if (!project || project.deletedAt) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Demo Not Available</h1>
          <p className="mt-2 text-muted-foreground">
            The demo project has not been set up yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceShell
      projectId={project.id}
      projectName={project.name}
      projectSlug="demo"
      isDemo
    />
  );
}
