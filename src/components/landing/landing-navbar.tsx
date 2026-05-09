"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  const { isSignedIn } = useAuth();

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            H
          </div>
          <span className="text-sm font-semibold">Hannibal</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/demo">Try Demo</Link>
          </Button>
          {isSignedIn ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Open App</Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
