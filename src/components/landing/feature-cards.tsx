"use client";

import { motion } from "motion/react";
import {
  Users,
  Swords,
  FileText,
  GitBranch,
  BarChart3,
  Map,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Personas",
    description:
      "Real users with goals, frustrations, and switching costs — not stock demographics. AI grounds them in your wedge.",
  },
  {
    icon: Swords,
    title: "Competitor Analysis",
    description:
      "Live web research finds positioning, structural weaknesses, and feature gaps mapped to where you can win.",
  },
  {
    icon: FileText,
    title: "Plans & PRDs",
    description:
      "Tell the AI what you're building. It interviews you, drafts the plan or PRD, and streams edits in-place when you refine.",
  },
  {
    icon: GitBranch,
    title: "Feature Tree",
    description:
      "Map the product as a hierarchy. AI suggests the children you missed and refines descriptions on demand.",
  },
  {
    icon: BarChart3,
    title: "RICE Priorities",
    description:
      "Score features with reach × impact × confidence ÷ effort. AI proposes scores with rationale grounded in your roadmap.",
  },
  {
    icon: Map,
    title: "Roadmap",
    description:
      "Drag bars across quarters. Swim lanes, milestones, and dependencies stay in sync with the feature tree.",
  },
] as const;

const ease = [0.25, 0.1, 0.25, 1] as const;

export function FeatureCards() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
          className="mb-12 text-center text-2xl font-semibold sm:text-3xl"
        >
          From idea to shipped roadmap.{" "}
          <span className="text-muted-foreground">AI asks, writes, and prioritizes.</span>
        </motion.h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease,
              }}
              whileHover={{ y: -2 }}
              className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-border"
            >
              <feature.icon className="mb-3 h-5 w-5 text-muted-foreground transition-colors group-hover:text-blue-400" />
              <h3 className="mb-1 text-sm font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
