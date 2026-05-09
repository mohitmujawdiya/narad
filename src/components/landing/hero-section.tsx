"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignupForm } from "./signup-form";

const ease = [0.25, 0.1, 0.25, 1] as const;

function WorkspaceMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.6, ease }}
      className="mx-auto mt-16 w-full max-w-5xl"
    >
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/30 p-1.5 shadow-2xl shadow-black/20 ring-1 ring-blue-600/10">
        <Image
          src="/landing-workspace-hero.png"
          alt="Hannibal workspace — sidebar with project navigation, dashboard with project health and roadmap pulse, AI panel showing a generated roadmap artifact"
          width={1600}
          height={1000}
          priority
          className="h-auto w-full rounded-lg"
        />
      </div>
    </motion.div>
  );
}

export function HeroSection() {
  return (
    <section className="pb-16 pt-24 sm:pt-32">
      <div className="mx-auto max-w-5xl px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease }}
        >
          <Badge
            variant="secondary"
            className="mb-6 gap-1.5 border-blue-600/20 bg-blue-600/10 px-3 py-1 text-xs text-blue-400"
          >
            <Sparkles className="h-3 w-3" />
            Founding Members
          </Badge>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease }}
          className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
        >
          Cursor for builders.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease }}
          className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground sm:text-xl"
        >
          From rough idea to shipped product — an AI co-pilot that asks the right questions, then writes every plan, PRD, and roadmap with you.
        </motion.p>

        {/* Signup form + Demo CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease }}
          className="mt-8 flex flex-col items-center gap-3"
        >
          <SignupForm />
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
            <Link href="/demo">
              <Play className="h-3.5 w-3.5" />
              Try the demo
            </Link>
          </Button>
        </motion.div>

        {/* Workspace mock */}
        <WorkspaceMock />
      </div>
    </section>
  );
}
