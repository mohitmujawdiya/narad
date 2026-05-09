import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "demo_user_hannibal";
const DEMO_PROJECT_SLUG = process.env.DEMO_PROJECT_SLUG ?? "demo";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = new PrismaPg({ connectionString });
  const db = new PrismaClient({ adapter });

  console.log("Seeding demo project...");

  // Upsert demo project
  const project = await db.project.upsert({
    where: { slug: DEMO_PROJECT_SLUG },
    update: { name: "TaskFlow — AI Task Manager", userId: DEMO_USER_ID },
    create: {
      name: "TaskFlow — AI Task Manager",
      slug: DEMO_PROJECT_SLUG,
      description:
        "A smart task management app that uses AI to auto-categorize, prioritize, and suggest next actions for busy professionals.",
      userId: DEMO_USER_ID,
    },
  });

  const projectId = project.id;
  console.log(`  Project: ${project.name} (${projectId})`);

  // ── Plan ─────────────────────────────────────────────────────────────

  await db.plan.deleteMany({ where: { projectId } });
  const plan = await db.plan.create({
    data: {
      projectId,
      title: "TaskFlow Product Plan",
      status: "APPROVED",
      content: `# TaskFlow — Product Plan

## Vision
Build the smartest personal task manager that learns from your behavior. While tools like Todoist and Things focus on manual organization, TaskFlow uses AI to reduce the friction of capturing, categorizing, and prioritizing work.

## Problem
Knowledge workers spend 15+ minutes daily organizing tasks across multiple tools. Existing solutions require manual tagging, project assignment, and priority setting — cognitive overhead that discourages consistent use.

## Target Users
- **Primary:** Busy professionals managing 20-50+ active tasks across projects
- **Secondary:** Freelancers juggling multiple clients and deadlines

## Key Hypotheses
1. AI auto-categorization will reduce task capture time by 60%
2. Smart priority suggestions will improve task completion rates by 25%
3. Natural language input will increase daily task capture volume by 2x

## Success Metrics
- **North Star:** Weekly active tasks completed per user
- **Activation:** 5+ tasks created in first session
- **Retention:** 60% D7 retention, 40% D30 retention
- **Engagement:** Average 3+ sessions per day

## Competitive Edge
Unlike Todoist (manual organization) or Notion (too flexible/complex), TaskFlow is opinionated: drop in a task in natural language and AI handles the rest. Think "Linear for personal productivity."

## Go-to-Market
- **Phase 1:** Launch on Product Hunt, target productivity communities (r/productivity, Hacker News)
- **Phase 2:** Freemium model — free tier (50 tasks/mo AI), Pro ($8/mo unlimited)
- **Phase 3:** Team features for small startups (5-20 people)

## Timeline
- **Month 1-2:** Core task CRUD + AI categorization MVP
- **Month 3:** Smart priorities + daily briefing
- **Month 4:** Mobile app (React Native)
- **Month 5:** Public beta + Product Hunt launch
`,
    },
  });
  console.log(`  Plan: ${plan.title}`);

  // ── PRD ──────────────────────────────────────────────────────────────

  await db.pRD.deleteMany({ where: { projectId } });
  const prd = await db.pRD.create({
    data: {
      projectId,
      planId: plan.id,
      title: "TaskFlow PRD — Core Experience",
      status: "DRAFT",
      content: `# TaskFlow PRD — Core Experience

## Overview
This PRD covers the core task management experience: natural language capture, AI auto-categorization, smart inbox, and daily briefing.

## User Stories

### Task Capture
- **As a user,** I want to type a task in natural language so I can capture it without thinking about organization
- **As a user,** I want the AI to auto-detect project, priority, and due date from my input
- **As a user,** I want to capture tasks via keyboard shortcut from anywhere in the app

### Smart Inbox
- **As a user,** I want to see my tasks organized by AI-suggested priority
- **As a user,** I want to override AI suggestions with one click
- **As a user,** I want tasks grouped by project with smart filters

### Daily Briefing
- **As a user,** I want a morning summary of what to focus on today
- **As a user,** I want the AI to flag overdue and at-risk tasks

## Functional Requirements

### FR-1: Natural Language Input
- Parse task title, project, priority, due date from free-text input
- Examples: "Review PR for auth service by Friday — high priority" → Title: Review PR for auth service, Project: Auth, Due: Friday, Priority: High
- Confidence threshold: show parsed fields for user confirmation when confidence < 80%

### FR-2: AI Categorization Engine
- Auto-assign project based on task content and user history
- Suggest priority (P0-P3) based on urgency signals and deadlines
- Learn from user corrections to improve over time

### FR-3: Smart Inbox View
- Default sort: AI-recommended priority
- Group by: Project, Priority, Due date
- Quick actions: Complete, Snooze, Re-prioritize

### FR-4: Daily Briefing
- Auto-generated at user's configured morning time
- Includes: today's tasks, overdue items, suggested focus areas
- Delivered via in-app notification + optional email

## Non-Functional Requirements
- Task capture latency: < 200ms (AI processing async)
- AI categorization accuracy: > 85% after 50+ tasks
- Support 10,000+ tasks per user without performance degradation

## Out of Scope (v1)
- Team/collaboration features
- Calendar integration
- File attachments
- Recurring tasks (v2)
`,
    },
  });
  console.log(`  PRD: ${prd.title}`);

  // ── Features ─────────────────────────────────────────────────────────

  await db.feature.deleteMany({ where: { projectId } });

  const coreFeature = await db.feature.create({
    data: {
      projectId,
      title: "Core Task Engine",
      description: "Foundation for task CRUD, storage, and real-time sync",
      status: "IN_PROGRESS",
      order: 0,
      riceReach: 1000,
      riceImpact: 3,
      riceConfidence: 0.9,
      riceEffort: 3,
      riceScore: 900,
    },
  });

  const nlpFeature = await db.feature.create({
    data: {
      projectId,
      title: "Natural Language Input",
      description: "Parse tasks from free-text with AI-powered field extraction",
      status: "TODO",
      order: 1,
      parentId: coreFeature.id,
      riceReach: 800,
      riceImpact: 3,
      riceConfidence: 0.8,
      riceEffort: 5,
      riceScore: 384,
    },
  });

  const categorizationFeature = await db.feature.create({
    data: {
      projectId,
      title: "AI Auto-Categorization",
      description:
        "Automatically assign project, priority, and tags based on task content and user history",
      status: "TODO",
      order: 2,
      parentId: coreFeature.id,
      riceReach: 800,
      riceImpact: 2,
      riceConfidence: 0.7,
      riceEffort: 8,
      riceScore: 140,
    },
  });

  const smartInboxFeature = await db.feature.create({
    data: {
      projectId,
      title: "Smart Inbox",
      description: "AI-prioritized task list with grouping and quick actions",
      status: "TODO",
      order: 3,
      riceReach: 1000,
      riceImpact: 2,
      riceConfidence: 0.85,
      riceEffort: 4,
      riceScore: 425,
    },
  });

  const dailyBriefingFeature = await db.feature.create({
    data: {
      projectId,
      title: "Daily Briefing",
      description: "Morning summary with focus suggestions and overdue alerts",
      status: "TODO",
      order: 4,
      riceReach: 600,
      riceImpact: 2,
      riceConfidence: 0.7,
      riceEffort: 3,
      riceScore: 280,
    },
  });

  console.log(
    `  Features: ${[coreFeature, nlpFeature, categorizationFeature, smartInboxFeature, dailyBriefingFeature].map((f) => f.title).join(", ")}`
  );

  // ── Personas ─────────────────────────────────────────────────────────

  await db.persona.deleteMany({ where: { projectId } });

  const persona1 = await db.persona.create({
    data: {
      projectId,
      name: "Sarah Chen",
      title: "Senior Product Manager at a Series B startup",
      demographics: "32, San Francisco, manages a team of 6",
      techProficiency: "High",
      quote: "I have 47 open tasks across 3 tools and no idea what to work on next.",
      goals: [
        "Spend less time organizing and more time executing",
        "Never miss a deadline or drop a commitment",
        "Have clear visibility into what matters most today",
      ],
      frustrations: [
        "Context-switching between Notion, Linear, and personal reminders",
        "Spending 20 minutes each morning just figuring out priorities",
        "Tasks falling through the cracks when captured in Slack or email",
      ],
      behaviors: [
        "Checks tasks first thing in the morning and after lunch",
        "Captures ideas on phone during commute",
        "Prefers keyboard shortcuts over mouse clicks",
      ],
    },
  });

  const persona2 = await db.persona.create({
    data: {
      projectId,
      name: "Marcus Johnson",
      title: "Freelance Designer & Developer",
      demographics: "28, Austin TX, works with 4-6 clients simultaneously",
      techProficiency: "Medium-High",
      quote: "Every client thinks they're my only client. I need a system that keeps me honest.",
      goals: [
        "Track deliverables across multiple client projects",
        "Avoid over-committing on timelines",
        "Quickly capture tasks during client calls",
      ],
      frustrations: [
        "No single view of all commitments across clients",
        "Forgetting to follow up on proposals and invoices",
        "Existing tools are either too simple or too complex",
      ],
      behaviors: [
        "Works in 2-3 hour deep work blocks",
        "Reviews all tasks Sunday evening for the week",
        "Uses phone for quick capture, desktop for planning",
      ],
    },
  });

  console.log(`  Personas: ${persona1.name}, ${persona2.name}`);

  // ── Competitors ──────────────────────────────────────────────────────

  await db.competitor.deleteMany({ where: { projectId } });

  const competitor1 = await db.competitor.create({
    data: {
      projectId,
      name: "Todoist",
      url: "https://todoist.com",
      positioning: "The leading cross-platform task manager for individuals and small teams",
      pricing: "Free (5 projects), Pro $4/mo, Business $6/user/mo",
      strengths: [
        "Excellent cross-platform support (web, mobile, desktop, browser extensions)",
        "Natural language date parsing for quick capture",
        "Mature ecosystem with 70+ integrations",
        "Strong brand recognition and large user base",
      ],
      weaknesses: [
        "No AI-powered categorization or prioritization",
        "Manual project assignment and labeling required",
        "Limited smart suggestions — mostly static organization",
        "Priority system is basic (P1-P4) with no intelligence",
      ],
      featureGaps: [
        "AI auto-categorization",
        "Smart priority suggestions",
        "Daily AI briefing",
        "Learning from user behavior",
      ],
    },
  });

  const competitor2 = await db.competitor.create({
    data: {
      projectId,
      name: "Things 3",
      url: "https://culturedcode.com/things/",
      positioning: "Award-winning personal task manager for Apple ecosystem with beautiful design",
      pricing: "$49.99 Mac, $9.99 iPhone, $19.99 iPad (one-time purchases)",
      strengths: [
        "Best-in-class UI/UX design — feels native and delightful",
        "Excellent keyboard shortcuts and quick capture",
        "One-time purchase model (no subscription fatigue)",
        "Deep Apple ecosystem integration (shortcuts, widgets)",
      ],
      weaknesses: [
        "Apple-only — no Windows, Android, or web app",
        "No AI or smart features — purely manual organization",
        "No collaboration features",
        "No API or third-party integrations",
      ],
      featureGaps: [
        "Cross-platform support",
        "AI-powered anything",
        "Team collaboration",
        "Web access",
      ],
    },
  });

  console.log(`  Competitors: ${competitor1.name}, ${competitor2.name}`);

  // ── Roadmap ──────────────────────────────────────────────────────────

  await db.roadmap.deleteMany({ where: { projectId } });

  const roadmap = await db.roadmap.create({
    data: {
      projectId,
      title: "TaskFlow Launch Roadmap",
      timeScale: "MONTHLY",
    },
  });

  const lane1 = await db.roadmapLane.create({
    data: {
      roadmapId: roadmap.id,
      name: "Engineering",
      color: "#3b82f6",
      order: 0,
    },
  });

  const lane2 = await db.roadmapLane.create({
    data: {
      roadmapId: roadmap.id,
      name: "Design",
      color: "#8b5cf6",
      order: 1,
    },
  });

  const lane3 = await db.roadmapLane.create({
    data: {
      roadmapId: roadmap.id,
      name: "Growth",
      color: "#10b981",
      order: 2,
    },
  });

  const now = new Date();
  const month = (offset: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() + offset);
    return d;
  };

  await db.roadmapItem.createMany({
    data: [
      {
        roadmapId: roadmap.id,
        laneId: lane1.id,
        featureId: coreFeature.id,
        title: "Core Task Engine",
        status: "IN_PROGRESS",
        type: "FEATURE",
        startDate: month(0),
        endDate: month(1),
        order: 0,
      },
      {
        roadmapId: roadmap.id,
        laneId: lane1.id,
        featureId: nlpFeature.id,
        title: "Natural Language Parser",
        status: "NOT_STARTED",
        type: "FEATURE",
        startDate: month(1),
        endDate: month(2),
        order: 1,
      },
      {
        roadmapId: roadmap.id,
        laneId: lane1.id,
        featureId: categorizationFeature.id,
        title: "AI Categorization Engine",
        status: "NOT_STARTED",
        type: "FEATURE",
        startDate: month(2),
        endDate: month(4),
        order: 2,
      },
      {
        roadmapId: roadmap.id,
        laneId: lane2.id,
        title: "Design System & UI Kit",
        status: "IN_PROGRESS",
        type: "FEATURE",
        startDate: month(0),
        endDate: month(1),
        order: 0,
      },
      {
        roadmapId: roadmap.id,
        laneId: lane2.id,
        title: "Mobile App Design",
        status: "NOT_STARTED",
        type: "FEATURE",
        startDate: month(2),
        endDate: month(3),
        order: 1,
      },
      {
        roadmapId: roadmap.id,
        laneId: lane3.id,
        title: "Product Hunt Launch",
        status: "NOT_STARTED",
        type: "MILESTONE",
        startDate: month(4),
        endDate: month(4),
        order: 0,
      },
      {
        roadmapId: roadmap.id,
        laneId: lane3.id,
        title: "Beta Waitlist & Community",
        status: "NOT_STARTED",
        type: "FEATURE",
        startDate: month(3),
        endDate: month(4),
        order: 1,
      },
    ],
  });

  console.log(`  Roadmap: ${roadmap.title} (${3} lanes, 7 items)`);

  console.log("\nDemo seed complete!");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
