"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FOUNDING_MEMBER_LIMIT = 100;

type SignupState = "idle" | "loading" | "success" | "error";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SignupState>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === "loading" || state === "success") return;

    setState("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error();
      setState("success");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  if (state === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-medium">You&apos;re in! Check your inbox.</span>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      >
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11 flex-1 bg-background/50 backdrop-blur-sm"
          disabled={state === "loading"}
        />
        <Button
          type="submit"
          size="lg"
          className="h-11 bg-blue-600 px-6 font-medium text-white hover:bg-blue-500"
          disabled={state === "loading" || !email}
        >
          {state === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Claim My Spot"
          )}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {state === "error"
          ? "Something went wrong. Please try again."
          : `Limited to ${FOUNDING_MEMBER_LIMIT} founding members`}
      </p>
    </div>
  );
}
