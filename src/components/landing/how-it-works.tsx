"use client";

import { motion } from "motion/react";

const steps = [
  {
    number: "01",
    title: "Bring a rough idea",
    description:
      "One sentence is enough. Vague, half-baked, or fully formed — the AI starts from whatever you give it.",
  },
  {
    number: "02",
    title: "AI interviews you, then writes",
    description:
      "Hannibal asks the questions other planners skip — who's in pain, what's broken about the alternative. Then drafts the plan, PRD, personas, and roadmap with you.",
  },
  {
    number: "03",
    title: "Iterate in the workspace",
    description:
      "Edit in-place, score with RICE, drag the roadmap. Saved artifacts feed the AI's context, so each new draft gets sharper.",
  },
] as const;

const ease = [0.25, 0.1, 0.25, 1] as const;

export function HowItWorks() {
  return (
    <section className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
          className="mb-12 text-center text-2xl font-semibold sm:text-3xl"
        >
          How it works
        </motion.h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.15,
                ease,
              }}
              className="text-center"
            >
              <div className="mb-3 text-3xl font-bold text-blue-600/40">
                {step.number}
              </div>
              <h3 className="mb-2 text-sm font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
