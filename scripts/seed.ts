import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const COMMON_BAN_PHRASES = [
  "I'm passionate about",
  "I would like to",
  "It would be a pleasure",
  "I'm reaching out because",
  "I came across your profile",
  "I'm interested in opportunities",
  "Looking for opportunities",
  "I admire what you're doing",
  "Hope this finds you well",
  "in the realm of",
  "stands as a testament",
  "navigating the complexities",
];

async function main() {
  console.log("Seeding…");

  // ─── Default templates (ported from CareerOps contacto.md) ───
  const templates = [
    {
      name: "linkedin-recruiter",
      channel: "linkedin",
      contactType: "recruiter",
      subject: null,
      body: `Hi {{firstName}} — {{fitLine}}. {{proofLine}}. Happy to share my CV if this aligns with what you're looking for.`,
      constraints: {
        maxChars: 300,
        tone: "direct",
        banPhrases: COMMON_BAN_PHRASES,
      },
      isSeed: true,
    },
    {
      name: "linkedin-hiring-manager",
      channel: "linkedin",
      contactType: "hiring-manager",
      subject: null,
      body: `Hi {{firstName}} — saw {{specificChallenge}}. {{quantifiableProof}}. Would love to hear how your team is approaching {{specificChallenge}}.`,
      constraints: {
        maxChars: 300,
        tone: "peer-to-peer",
        banPhrases: COMMON_BAN_PHRASES,
      },
      isSeed: true,
    },
    {
      name: "linkedin-peer",
      channel: "linkedin",
      contactType: "peer",
      subject: null,
      body: `Hi {{firstName}} — read your {{specificContent}} and resonated with {{specificPoint}}. I've been working on {{relevantWork}} — would love to hear your take on {{topic}}.`,
      constraints: {
        maxChars: 300,
        tone: "curious",
        banPhrases: COMMON_BAN_PHRASES,
      },
      isSeed: true,
    },
    {
      name: "linkedin-interviewer",
      channel: "linkedin",
      contactType: "interviewer",
      subject: null,
      body: `Hi {{firstName}} — saw {{specificResearch}}. Connecting ahead of our conversation on {{interviewDate}} — looking forward to it.`,
      constraints: {
        maxChars: 300,
        tone: "light",
        banPhrases: COMMON_BAN_PHRASES,
      },
      isSeed: true,
    },
    {
      name: "email-hiring-manager",
      channel: "email",
      contactType: "hiring-manager",
      subject: "{{specificChallenge}} at {{companyName}}",
      body: `Hi {{firstName}},

{{contextLine}} — and noticed {{specificSignal}}. Wanted to reach out because {{personalConnection}}.

{{evidenceParagraph}}

If you're open to a quick conversation about how {{relevantSkill}} could help with {{specificChallenge}}, I'd love to find 15 minutes.

Thanks,
{{senderName}}`,
      constraints: {
        maxChars: 850,
        tone: "peer-to-peer",
        banPhrases: COMMON_BAN_PHRASES,
      },
      isSeed: true,
    },
    {
      name: "email-recruiter",
      channel: "email",
      contactType: "recruiter",
      subject: "{{role}} interest — {{senderName}}",
      body: `Hi {{firstName}},

{{fitLine}}.

{{proofLine}}.

CV attached if helpful — happy to chat about timing and process whenever convenient.

{{senderName}}`,
      constraints: {
        maxChars: 850,
        tone: "direct",
        banPhrases: COMMON_BAN_PHRASES,
      },
      isSeed: true,
    },
  ];

  for (const t of templates) {
    await db.template.upsert({
      where: { name: t.name },
      update: t,
      create: t,
    });
  }
  console.log(`✓ Upserted ${templates.length} templates`);

  // ─── Default sequence (cadence engine kicks in fully in A3; data seeded now) ───
  const recruiterTemplate = await db.template.findUniqueOrThrow({ where: { name: "email-hiring-manager" } });
  const peerTemplate = await db.template.findUniqueOrThrow({ where: { name: "linkedin-peer" } });

  await db.sequence.upsert({
    where: { name: "default-3-touch" },
    update: {},
    create: {
      name: "default-3-touch",
      description: "Cold (Touch 1) → 4d → Bump (Touch 2) → 7d → Final (Touch 3)",
      isDefault: true,
      steps: [
        { step: 1, delayDays: 0, templateId: recruiterTemplate.id, condition: {} },
        { step: 2, delayDays: 4, templateId: peerTemplate.id, condition: { ifNotReplied: true } },
        { step: 3, delayDays: 7, templateId: peerTemplate.id, condition: { ifNotReplied: true } },
      ],
    },
  });
  console.log("✓ Upserted default sequence");

  // ─── Profile singleton ───
  await db.profile.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      visaDisclosurePolicy: "never-proactive",
    },
  });
  console.log("✓ Upserted profile singleton");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
