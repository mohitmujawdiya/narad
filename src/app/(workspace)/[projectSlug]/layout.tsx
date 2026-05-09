import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isCuid } from "@/lib/slug";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

type WorkspaceLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ projectSlug: string }>;
};

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { projectSlug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Resolve slug or CUID to project
  let project = await db.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true, slug: true, name: true, userId: true, deletedAt: true },
  });

  // Fall back to CUID lookup for backward compatibility
  if (!project && isCuid(projectSlug)) {
    project = await db.project.findUnique({
      where: { id: projectSlug },
      select: { id: true, slug: true, name: true, userId: true, deletedAt: true },
    });

    // Redirect CUID URLs to slug URLs
    if (project && !project.deletedAt && project.userId === userId) {
      redirect(`/${project.slug}`);
    }
  }

  if (!project || project.deletedAt || project.userId !== userId) {
    redirect("/");
  }

  return (
    <WorkspaceShell
      projectId={project.id}
      projectName={project.name}
      projectSlug={project.slug}
    />
  );
}
