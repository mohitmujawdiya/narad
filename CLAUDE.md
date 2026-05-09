# Hannibal — AI-Native Product Management Platform

## Product
"Cursor for builders." An AI-native workspace where solo founders, product engineers, and small AI-native teams create plans, PRDs, feature trees, roadmaps, personas, and competitive analysis — with AI assistance throughout.

## Tech Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- MarkdownDoc component (react-markdown + textarea edit mode) for rich text surfaces (plans, PRDs)
- @xyflow/react + dagre for feature tree visualization
- dnd-timeline + dnd-kit for roadmap timeline drag-and-drop
- react-resizable-panels for the workspace layout
- tRPC v11 for type-safe API, Prisma 7 + PostgreSQL for data
- Vercel AI SDK v6 (OpenAI GPT-4o) for AI streaming and tool calling, Tavily for web search
- Zustand 5 for client state, TanStack Query 5 for server state
- Clerk for auth

## Workspace Layout (Three-Panel)
```
┌──────────┬──────────────────────┬──────────────┐
│ Sidebar  │ Main Content Area    │ AI Panel     │
│ (nav)    │ (active view)        │ (persistent) │
└──────────┴──────────────────────┴──────────────┘
```
- Sidebar: project list + view switcher. Collapsible (Cmd+B).
- Main Content: renders the active view. Views mount/unmount but preserve state via Zustand.
- AI Panel: persistent chat. Context-aware of the active view. Collapsible (Cmd+L).
- Panels use react-resizable-panels. Cmd+K opens command palette.

## Context Bridge
Zustand store `useWorkspaceContext` connects all three panels:
- Exposes: activeView, selectedEntity, highlightedText, projectId
- Views write to it; AI Panel reads from it for context-aware responses
- AI Panel writes artifacts back, which views consume

## Folder Structure
- `src/app/(workspace)/[projectId]/layout.tsx` — workspace shell
- `src/app/api/chat/route.ts` — AI chat endpoint (streaming, tool calls, project context)
- `src/app/api/trpc/` — tRPC API handler
- `src/components/workspace/` — shell components (sidebar, ai-panel, main-content, project-switcher)
- `src/components/views/` — main content views (plan-editor, feature-tree, roadmap, etc.)
- `src/components/views/dashboard/` — overview dashboard widgets
- `src/components/views/roadmap/` — roadmap timeline sub-components
- `src/components/ai/` — AI panel sub-components (artifact-card)
- `src/components/editor/` — MarkdownDoc component (react-markdown + textarea)
- `src/components/ui/` — shadcn/ui primitives
- `src/hooks/` — shared hooks (use-conversation, use-project-data, use-debounced-mutation)
- `src/lib/` — utilities (artifact types, markdown parsers, RICE scoring, rate limiting)
- `src/lib/transforms/` — artifact serialization transforms (plan, prd, persona, competitor, feature-tree, roadmap)
- `src/server/routers/` — tRPC routers (project, plan, prd, feature, persona, competitor, roadmap, conversation)
- `src/server/ai/prompts/` — system prompt builder + artifact serializers
- `src/server/ai/tools/` — AI tool definitions (generate-artifact, read-artifact, web-search)
- `src/server/services/` — business logic (feature-sync, roadmap-sync, project-context, auth, artifact)
- `src/stores/` — Zustand stores (workspace-context, artifact-store, project-store)
- `prisma/` — schema and migrations

---

## React Component Conventions
- Functional components only, named exports (no default exports except Next.js pages)
- Props: `type XProps = {}` (not interface)
- Use `cn()` from `@/lib/utils` for conditional classnames
- shadcn/ui is the base — extend it, don't reinvent

### Naming
- Components: PascalCase (`FeatureTree`, `AiPanel`)
- Files: kebab-case (`feature-tree.tsx`, `ai-panel.tsx`)
- Hooks: `use` prefix (`useWorkspaceContext`)
- Event handlers: `on` prefix in props, `handle` prefix in implementation

### Views (src/components/views/)
Every view must:
1. Accept a `projectId` prop
2. Register with context bridge on mount via `useWorkspaceContext`
3. Clean up context on unmount

### Imports
- Use `@/` path alias for all imports from `src/`
- Group: React/Next → external libs → @/components → @/lib → @/stores → relative

---

## tRPC Router Conventions
- One router per domain: `project.ts`, `feature.ts`, `plan.ts`, `conversation.ts`
- Merge all in `src/server/routers/_app.ts`
- All procedures use Zod for input validation
- Always use `protectedProcedure` unless explicitly public
- Input: `.min()`, `.max()` on strings; `.cuid()` on IDs
- Return Prisma types directly — types flow end-to-end
- Errors: throw `TRPCError` with code (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`)
- Keep procedures thin — complex logic goes in `src/server/services/`

---

## Zustand Store Conventions
- One store per concern: `workspace-context.ts`, `project-store.ts`
- Use selectors: `useWorkspaceContext((s) => s.activeView)`
- Never put server-fetched data in Zustand — that goes through tRPC + TanStack Query
- Zustand is for UI state only: active view, selections, panel state, draft text
- Keep stores flat

---

## AI Orchestration
- Vercel AI SDK (`ai` package) for streaming and tool calling
- OpenAI GPT-5 family (default `gpt-5.4`, with `gpt-5.4-mini`, `gpt-5-pro`, `o3`, `gpt-4o`) selected by the model router; Tavily API for web research
- Single chat endpoint (`src/app/api/chat/route.ts`) orchestrates all AI via `streamText`
- System prompt built dynamically in `src/server/ai/prompts/system.ts` with view context + artifact state
- Tool definitions in `src/server/ai/tools/` (generate-artifact, read-artifact, web-search, ask-follow-up, ask-open-question, propose-and-confirm, edit-artifact)
- Include `maxOutputTokens` and `temperature` explicitly
- Artifacts are typed (`plan | prd | persona | featureTree | competitor | roadmap`), rendered inline in AI panel, saved to DB on "Push to View"

### Three-Tier Artifact Context
The system prompt includes artifact state tiered by relevance to the active view:
- **Tier 1 (full content):** Artifacts matching the active view (e.g. plan artifact on plan view) — serialized in full up to 8000 chars
- **Tier 2 (summaries):** All other artifacts — one-line summaries with counts and structure
- View-to-artifact mapping defined in `VIEW_PRIMARY_ARTIFACTS` in `system.ts`
- `readArtifact` / `readAllArtifacts` tools let the AI fetch full content for Tier 2 artifacts on demand

### Expert Prompt Pattern
Tool descriptions use expert personas with per-section quality criteria rather than format-only instructions. Section headings are framed as "typical sections (include all that apply, skip or add as context demands)" so the AI can adapt structure to context.

### Guest Routes — `/demo` and `/playground`
Two unauthenticated entry points share `DEMO_USER_ID` but track different cookies and serve different intents:
- **`/demo`** — populated showcase project (slug from `DEMO_PROJECT_SLUG`). Stricter chat rate limit (`demoChatLimiter`). Cookie: `hannibal-demo`. Used to show "this is what Hannibal looks like populated."
- **`/playground`** — empty sandbox auto-created on first visit (slug from `PLAYGROUND_PROJECT_SLUG`, e.g. for evaluation links you send to a hiring manager). Normal chat rate limit. Cookie: `hannibal-playground`. The layout `findFirst`s the project under `DEMO_USER_ID` and creates it if missing or undeletes it if soft-deleted.

Both routes redirect authenticated users to `/`. `proxy.ts` sets the relevant cookie and exempts both paths from `auth.protect()`. tRPC context (`src/server/trpc.ts`) and the chat route (`src/app/api/chat/route.ts`) both check for either cookie and fall back to `DEMO_USER_ID`. `WorkspaceShell` renders a different banner per mode (`isDemo` vs `isPlayground`).

### Model Router (Auto by default)
`src/server/ai/model-router.ts` picks the OpenAI model per request:
- "Auto" (default) routes by intent: priorities/RICE keywords or active view → `o3` (reasoning); "deep/thorough/comprehensive" → `gpt-5-pro`; "refine/edit/tweak" → `gpt-5.4-mini`; otherwise `gpt-5.4`.
- Explicit choices override: `gpt-5.4`, `gpt-5.4-mini`, `gpt-5-pro`, `o3`, `gpt-4o`.
- `temperatureFor(model)` returns `undefined` for o-series (which constrain temperature) and `0.7` for everything else.
- Model picker in `ai-panel.tsx` exposes the choices; default state is "auto".

### Client-Side Caching
- `providers.tsx` sets a global `staleTime: 30_000` and `refetchOnWindowFocus: false` on the QueryClient. View switches within 30s read from cache instead of refetching.
- `WorkspaceShell` prefetches the six artifact list queries (plan/prd/persona/competitor/feature.tree/roadmap.list) on project mount. tRPC's `httpBatchLink` coalesces them into a single HTTP request, so the cache is warm regardless of which view the user lands on (covers URL-direct visits like `/<project>/plan`).
- Mutations explicitly invalidate the relevant list query in `onSuccess`, so writes still reflect immediately. The 30s window only affects re-mounts of components reading the same key.
- `WorkspaceSkeleton` is a static layout placeholder (no shimmer animation) — animated skeletons made brief mount delays feel longer than they were.

### Undo / Redo
`useUndoRedo<T>` in `src/hooks/use-undo-redo.ts` is a generic history stack used by both the feature tree and the roadmap. The caller snapshots state before each user action and calls `undo(current)` / `redo(current)` to swap it. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z keyboard handlers in each view, plus toolbar buttons in the same grouped-border style. For the roadmap, the snapshot is `{ lanes, items }` and `handleUpdate` is the single mutation point that funnels every drag, resize, save, delete, lane rename, import, and time-scale change — so one push covers everything.

### Sync-Service Performance
`feature.syncTree` and `roadmap.syncFull` write many rows in one transaction. They were rewritten to parallelize:
- Updates run in parallel (`Promise.all`) — no inter-row dependencies.
- Feature-tree creates run in waves: nodes whose parent is resolved go in a wave together, then the next wave once IDs are recorded — O(tree-depth) round-trips instead of O(node-count).
- Roadmap items run in parallel after lanes finish (since items reference lane IDs from the lane creates).
- Both transactions use a 10s timeout — comfortable for the post-parallel happy path (~1-2s) without papering over genuine runaway transactions.

### Roadmap rendering
Lane height auto-grows with `subrows.length`. Subrow assignment is in `groupItemsToSubrowsByVisualOverlap` (`src/lib/roadmap-utils.ts`):
- **Bars** share subrows by time-span overlap (greedy first-fit).
- **Milestones** each get their own subrow — their titles render past the diamond marker into adjacent items' space, and time-span overlap detection alone misses this.

### Follow-Up Engine (three asking tools)
Clarification is handled by three human-in-the-loop tools, picked by the model based on question shape:
- **`proposeAndConfirm`** (default when context allows a defensible guess): AI commits to an assumption with reasoning + 2-4 implications; user clicks Confirm / Refine / Replace. Most respectful of user time — shows the AI listened. Renderer: `src/components/ai/propose-confirm-card.tsx`.
- **`askFollowUp`**: 1-4 batched questions per call, each with 2-4 problem-first options. Per-question `header` chip, `multiSelect` boolean, "(Recommended)" first-position pattern, "Other..." auto-injected. Schema: `{ questions: [{ question, header, options, multiSelect }] }`. Renderer: `src/components/ai/follow-up-card.tsx`.
- **`askOpenQuestion`**: free-text prose for paragraph-shaped answers (research, anecdotes, constraints AI can't enumerate). Renderer: `src/components/ai/open-question-card.tsx`.

Triggering rule: ask only on genuine ambiguity (problem-first dimensions: who/pain/wedge before plan-type/scope before MBA-bucket). Cap at 3 clarification turns per request. Auto-send on tool-output via `sendAutomaticallyWhen` in ai-panel; works for all three tools. Question forms whose subject is the product/AI/capabilities ("What unique AI capability...") are explicitly banned in the prompt — every clarifying question must put the user and their pain in the subject.

### Artifact Parsing & Extras Catch-All
- Persona and competitor artifacts are stored as markdown but parsed into structured fields for card UI rendering
- Parsers are in `src/lib/markdown-to-artifact.ts` with inverse builders in the view components
- **Extras catch-all:** `extractUnrecognizedSections()` captures any bold-labeled sections the parser doesn't explicitly handle, so new AI-generated sections render instead of being silently dropped
- Known fields get structured pretty rendering (colored icons, grids); unknown extras render as neutral text blocks

### Conversation Persistence
- Chat history persisted to DB via `conversation` tRPC router
- Messages serialized/deserialized via `src/lib/chat-serialization.ts`
- `useConversation` hook manages conversation lifecycle per project
- Project context (saved artifacts from DB) loaded server-side in the chat route via `src/server/services/project-context.ts`

---

## Prisma & Database Conventions
- Models: PascalCase singular; tables: snake_case plural via `@@map()`
- Fields: camelCase in Prisma, snake_case in DB via `@map()`
- Every model: `id` (cuid), `createdAt`, `updatedAt`
- Soft deletes: `deletedAt DateTime?` where needed
- Ordering: explicit `order Int` for reorderable lists
- Foreign keys: `onDelete: Cascade` for children, `onDelete: SetNull` for optional refs
- JSON fields for flexible AI-generated content
- Prisma enums for status fields
- Project is top-level container; Features have self-referential parent/child tree
