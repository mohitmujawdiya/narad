import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { generateSlug, ensureUniqueSlug } from "@/lib/slug";
import { LandingPage } from "@/components/landing/landing-page";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    let project = await db.project.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true },
    });

    if (!project) {
      const name = "My First Project";
      const baseSlug = generateSlug(name);
      const existingSlugs = new Set(
        (await db.project.findMany({ select: { slug: true } })).map(
          (p) => p.slug
        )
      );
      const slug = ensureUniqueSlug(baseSlug, existingSlugs);

      project = await db.project.create({
        data: { name, slug, userId },
        select: { id: true, slug: true },
      });
    }

    redirect(`/${project.slug}`);
  }

  return <LandingPage />;
}
