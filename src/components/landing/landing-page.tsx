"use client";

import { motion } from "motion/react";
import { LandingNavbar } from "./landing-navbar";
import { HeroSection } from "./hero-section";
import { FeatureCards } from "./feature-cards";
import { HowItWorks } from "./how-it-works";
import { SignupForm } from "./signup-form";
import { LandingFooter } from "./landing-footer";

const ease = [0.25, 0.1, 0.25, 1] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <HeroSection />
        <FeatureCards />
        <HowItWorks />

        {/* Bottom CTA */}
        <section className="border-t border-border/50 py-24">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease }}
              className="mb-8 text-2xl font-semibold sm:text-3xl"
            >
              Ready to shape the future of PM?
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1, ease }}
            >
              <SignupForm />
            </motion.div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
