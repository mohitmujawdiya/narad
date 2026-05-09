"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  PanelRightClose,
  Send,
  Globe,
  Sparkles,
  MoreHorizontal,
  Loader2,
  Square,
  ChevronDown,
  Trash2,
  BookOpen,
  MessageCircleQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { trpc } from "@/lib/trpc";
import { useProjectFeatureTree, useProjectRoadmap } from "@/hooks/use-project-data";
import { useConversation } from "@/hooks/use-conversation";
import { ArtifactCard } from "@/components/ai/artifact-card";
import { FollowUpCard } from "@/components/ai/follow-up-card";
import { OpenQuestionCard } from "@/components/ai/open-question-card";
import {
  ProposeConfirmCard,
  type ProposeConfirmAnswer,
} from "@/components/ai/propose-confirm-card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { localChatStore } from "@/lib/chat-persistence";
import { sanitizeUrl } from "@/lib/sanitize-url";
import type { Artifact, FeatureNode, RoadmapArtifact, RoadmapItem } from "@/lib/artifact-types";
import { artifactToSyncInput } from "@/lib/transforms/roadmap";
import { generateId } from "@/lib/roadmap-utils";

type AiPanelProps = {
  projectId: string;
};

// gpt-5-pro and o3 are temporarily disabled — they routinely exceed Vercel
// Hobby's 60s function timeout. Re-enable when on Vercel Pro / Fluid Compute
// (also restore the routing branches in src/server/ai/model-router.ts).
const MODEL_OPTIONS = [
  { id: "auto", label: "Auto" },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "gpt-4o", label: "GPT-4o (legacy)" },
] as const;

const WELCOME_MESSAGE = "Hey! I'm Hannibal, your AI product co-pilot. Describe a problem you're trying to solve, and I'll help you research it, plan it, and build it.\n\nTry something like:\n- \"I want to build a fitness tracking app\"\n- \"Help me analyze the competitor landscape for task management tools\"\n- \"Generate user personas for an e-commerce platform\"";

export function AiPanel({ projectId }: AiPanelProps) {
  const activeView = useWorkspaceContext((s) => s.activeView);
  const selectedEntity = useWorkspaceContext((s) => s.selectedEntity);
  const highlightedText = useWorkspaceContext((s) => s.highlightedText);
  const toggleAiPanel = useWorkspaceContext((s) => s.toggleAiPanel);
  const focusAiInput = useWorkspaceContext((s) => s.focusAiInput);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottom = useRef(true);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("auto");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  // After submit we want to anchor the new user message at the top of the
  // chat viewport (so the user sees their question + AI response flowing
  // below it) instead of pinning scroll to bottom while the AI streams.
  const pendingAnchorTopRef = useRef(false);

  useEffect(() => {
    if (focusAiInput > 0) {
      // Small delay to ensure panel is rendered after opening
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [focusAiInput]);

  const welcomeMessages = useMemo(() => [
    {
      id: "welcome",
      role: "assistant" as const,
      content: WELCOME_MESSAGE,
      parts: [{ type: "text" as const, text: WELCOME_MESSAGE }],
    },
  ], []);

  const bodyRef = useRef({ activeView, selectedEntity, highlightedText, model });
  bodyRef.current = { activeView, selectedEntity, highlightedText, model };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          ...bodyRef.current,
          projectId,
          projectName: "Demo Project",
        }),
      }),
    [],
  );

  const { messages, setMessages, sendMessage, status, stop, addToolOutput } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages: msgs }) => {
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      if (!lastAssistant) return false;
      // Only auto-send when one of the asking tools is the LAST tool part (user just
      // answered). After the continuation, generatePlan etc. become the last tool part
      // → returns false.
      const toolParts = lastAssistant.parts.filter(
        (p: { type?: string }) => p.type?.startsWith("tool-") || p.type === "dynamic-tool",
      );
      if (toolParts.length === 0) return false;
      const last = toolParts[toolParts.length - 1] as {
        type?: string;
        toolName?: string;
        state?: string;
      };
      const ASK_TOOLS = new Set([
        "askFollowUp",
        "askOpenQuestion",
        "proposeAndConfirm",
      ]);
      const staticAskType =
        last.type?.startsWith("tool-") && ASK_TOOLS.has(last.type.slice(5));
      const dynamicAsk =
        last.type === "dynamic-tool" && ASK_TOOLS.has(last.toolName ?? "");
      return (staticAskType || dynamicAsk) && last.state === "output-available";
    },
  });

  const { initialize, syncMessages: syncToDb, clearConversation } = useConversation(projectId);

  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    initialize().then((dbMessages) => {
      // Deduplicate by id (safety net against stale data)
      const dedup = (msgs: typeof dbMessages) => {
        const seen = new Set<string>();
        return msgs.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      };

      if (dbMessages.length > 0) {
        const clean = dedup(dbMessages);
        // DB has messages — use them and warm localStorage cache
        setMessages(clean as Parameters<typeof setMessages>[0]);
        localChatStore.save(projectId, clean as Parameters<typeof localChatStore.save>[1]);
      } else {
        // Fall back to localStorage, then welcome
        const stored = dedup(localChatStore.load(projectId));
        // If localStorage is corrupted (too many messages), discard it
        if (stored.length > 200) {
          localChatStore.clear(projectId);
          setMessages(welcomeMessages as Parameters<typeof setMessages>[0]);
        } else {
          const toSet = stored.length > 0 ? stored : welcomeMessages;
          setMessages(toSet as Parameters<typeof setMessages>[0]);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize/setMessages are stable refs, only run once on mount
  }, [projectId]);

  const isStreaming = status === "streaming";
  const isLoading = status === "submitted";

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    isAtBottom.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isAtBottom.current = true;
    setShowScrollBtn(false);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // After a fresh submit, anchor the just-sent user message at the top of
    // the viewport so the user reads their question + AI response top-down
    // instead of being pinned to the bottom of the streaming text.
    if (pendingAnchorTopRef.current) {
      pendingAnchorTopRef.current = false;
      // Wait one frame so the new message is rendered and measurable.
      requestAnimationFrame(() => {
        const userMsgs = el.querySelectorAll<HTMLElement>('[data-message-role="user"]');
        const last = userMsgs[userMsgs.length - 1];
        if (last) {
          // offsetTop is relative to the nearest positioned ancestor; the
          // scroll container itself isn't necessarily that ancestor, so use
          // getBoundingClientRect for an accurate offset.
          const containerTop = el.getBoundingClientRect().top;
          const messageTop = last.getBoundingClientRect().top;
          const delta = messageTop - containerTop + el.scrollTop - 8;
          el.scrollTo({ top: delta, behavior: "smooth" });
          isAtBottom.current = false;
          setShowScrollBtn(true);
        }
      });
      return;
    }

    if (isAtBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (status === "ready" && messages.length > 1) {
      localChatStore.save(projectId, messages as Parameters<typeof localChatStore.save>[1]);
      syncToDb(messages as Parameters<typeof syncToDb>[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- syncToDb is a stable ref
  }, [status, messages, projectId]);

  // Clean up incomplete AI edits when streaming stops (user clicks Stop or error)
  useEffect(() => {
    if (status === "ready") {
      const edit = useWorkspaceContext.getState().aiEdit;
      if (edit && !edit.isComplete) {
        useWorkspaceContext.getState().clearAiEdit();
      }
    }
  }, [status]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    pendingAnchorTopRef.current = true;
    isAtBottom.current = false;
    sendMessage({ text });
  }, [input, sendMessage]);

  const handleFollowUpAnswer = useCallback(
    async (
      toolCallId: string,
      answers: Array<{ header: string; answer: string }>,
    ) => {
      await addToolOutput({
        tool: "askFollowUp",
        toolCallId,
        output: { answers },
      });
    },
    [addToolOutput],
  );

  const handleOpenAnswer = useCallback(
    async (toolCallId: string, answer: string) => {
      await addToolOutput({
        tool: "askOpenQuestion",
        toolCallId,
        output: { answer },
      });
    },
    [addToolOutput],
  );

  const handleProposeAnswer = useCallback(
    async (toolCallId: string, answer: ProposeConfirmAnswer) => {
      await addToolOutput({
        tool: "proposeAndConfirm",
        toolCallId,
        output: answer,
      });
    },
    [addToolOutput],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/30 border-l border-border/40 w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-base font-semibold">Hannibal AI</span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
                onSelect={() => {
                  setMoreMenuOpen(false);
                  setClearDialogOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Clear chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will erase all AI conversation history for this project. The AI will lose context of previous discussions, though it can still read your saved plans, PRDs, features, and other artifacts.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    localChatStore.clear(projectId);
                    clearConversation();
                    setMessages(welcomeMessages as Parameters<typeof setMessages>[0]);
                  }}
                >
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleAiPanel}
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-y-auto" ref={scrollRef} onScroll={handleScroll}>
          <div className="space-y-4 pb-4 px-4 py-3 w-full min-w-0">
            {messages.filter((message, index, arr) =>
              arr.findIndex((m) => m.id === message.id) === index
            ).map((message) => (
              <div key={message.id} data-message-id={message.id} data-message-role={message.role} className="space-y-1">
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {getUserText(message)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {message.parts?.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <div
                            key={i}
                            className="text-sm text-foreground leading-relaxed prose prose-invert prose-sm !max-w-none w-full break-words [overflow-wrap:anywhere] [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_code]:text-xs [&_table]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_hr]:border-border/50 [&_hr]:my-3"
                          >
                            <MessageMarkdown content={part.text} />
                          </div>
                        );
                      }
                      const tool = extractToolInfo(part);
                      if (tool) {
                        return renderToolPart(tool, i, projectId, {
                          onFollowUpAnswer: handleFollowUpAnswer,
                          onOpenAnswer: handleOpenAnswer,
                          onProposeAnswer: handleProposeAnswer,
                        });
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </div>
            )}
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-muted/90 border border-border/50 shadow-md backdrop-blur-sm transition-opacity hover:bg-muted"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Input */}
      <Separator />
      <div className="p-3 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="Ask about your product..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="min-h-[40px] max-h-[120px] resize-none pr-10 text-sm bg-muted/50 border-0 focus-visible:ring-1"
            />
            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute bottom-1 right-1 h-7 w-7"
                onClick={stop}
              >
                <Square className="h-3.5 w-3.5 text-destructive" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute bottom-1 right-1 h-7 w-7"
                disabled={!input.trim()}
              >
                <Send
                  className={cn(
                    "h-4 w-4",
                    input.trim()
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
              </Button>
            )}
          </div>
        </form>
        <div className="mt-1.5 flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded"
              >
                {MODEL_OPTIONS.find((m) => m.id === model)?.label ?? "Auto"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
              {MODEL_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => setModel(opt.id)}
                  className={cn("text-xs", model === opt.id && "font-semibold")}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

type ToolInfo = {
  toolName: string;
  toolCallId: string;
  state: string;
  input: Record<string, unknown> | undefined;
  output: Record<string, unknown> | undefined;
};

const ARTIFACT_TOOL_LABELS: Record<string, string> = {
  generatePlan: "Generating plan",
  generatePRD: "Generating PRD",
  generatePersona: "Creating persona",
  generateFeatureTree: "Building feature tree",
  generateCompetitor: "Analyzing competitor",
  suggestPriorities: "Scoring features",
  refineFeatureDescription: "Refining description",
  generateRoadmap: "Building roadmap",
  updateRoadmap: "Updating roadmap",
};

function extractToolInfo(part: unknown): ToolInfo | null {
  const p = part as Record<string, unknown>;
  const type = p.type as string;
  if (!type) return null;

  // AI SDK v6 static tools: type = "tool-{name}"
  if (type.startsWith("tool-")) {
    return {
      toolName: type.slice(5),
      toolCallId: (p.toolCallId as string) ?? "",
      state: (p.state as string) ?? "call",
      input: p.input as Record<string, unknown> | undefined,
      output: p.output as Record<string, unknown> | undefined,
    };
  }

  // AI SDK v6 dynamic tools (client doesn't define tool schemas)
  if (type === "dynamic-tool") {
    return {
      toolName: (p.toolName as string) ?? "",
      toolCallId: (p.toolCallId as string) ?? "",
      state: (p.state as string) ?? "call",
      input: p.input as Record<string, unknown> | undefined,
      output: p.output as Record<string, unknown> | undefined,
    };
  }

  return null;
}

type AskHandlers = {
  onFollowUpAnswer?: (
    toolCallId: string,
    answers: Array<{ header: string; answer: string }>,
  ) => void;
  onOpenAnswer?: (toolCallId: string, answer: string) => void;
  onProposeAnswer?: (toolCallId: string, answer: ProposeConfirmAnswer) => void;
};

function renderToolPart(
  tool: ToolInfo,
  key: number,
  projectId: string,
  handlers: AskHandlers = {},
) {
  const { onFollowUpAnswer, onOpenAnswer, onProposeAnswer } = handlers;
  const isComplete = tool.state === "output-available";

  if (tool.toolName === "askFollowUp") {
    // Normalize input: new shape is { questions: [...] }; legacy is { question, options }
    type RawQuestion = {
      question?: string;
      header?: string;
      options?: Array<{ label?: string; description?: string }>;
      multiSelect?: boolean;
    };
    const rawNew = tool.input?.questions as RawQuestion[] | undefined;
    const legacyQuestion = tool.input?.question as string | undefined;
    const legacyOptions = tool.input?.options as
      | Array<{ label: string; description?: string }>
      | undefined;

    const questions =
      rawNew && rawNew.length > 0
        ? rawNew
            .filter(
              (q): q is Required<Pick<RawQuestion, "question" | "options">> & RawQuestion =>
                !!q.question && Array.isArray(q.options) && q.options.length >= 2,
            )
            .map((q) => ({
              question: q.question!,
              header: q.header ?? "",
              options: (q.options ?? [])
                .filter((o): o is { label: string; description?: string } => !!o.label)
                .map((o) => ({ label: o.label, description: o.description })),
              multiSelect: q.multiSelect ?? false,
            }))
        : legacyQuestion && legacyOptions && legacyOptions.length > 0
          ? [
              {
                question: legacyQuestion,
                header: "",
                options: legacyOptions,
                multiSelect: false,
              },
            ]
          : [];

    if (isComplete) {
      // Normalize output: new shape is { answers: [...] }; legacy is { answer }
      const rawAnswers = tool.output?.answers as
        | Array<{ header?: string; answer?: string }>
        | undefined;
      const legacyAnswer = tool.output?.answer as string | undefined;
      const selectedAnswers =
        rawAnswers && rawAnswers.length > 0
          ? rawAnswers.map((a) => ({
              header: a.header ?? "",
              answer: a.answer ?? "",
            }))
          : legacyAnswer
            ? [{ header: "", answer: legacyAnswer }]
            : [];
      return (
        <FollowUpCard
          key={key}
          questions={questions}
          disabled
          selectedAnswers={selectedAnswers}
          onSubmit={() => {}}
        />
      );
    }

    // Interactive state — only render once at least one question has its options populated
    if (questions.length > 0 && questions[0].options.length >= 2) {
      return (
        <FollowUpCard
          key={key}
          questions={questions}
          onSubmit={(answers) =>
            onFollowUpAnswer?.(tool.toolCallId, answers)
          }
        />
      );
    }

    // Input still streaming
    return (
      <ToolProgressCard
        key={key}
        icon={MessageCircleQuestion}
        label="Thinking"
      />
    );
  }

  if (tool.toolName === "askOpenQuestion") {
    const question = (tool.input?.question as string) ?? "";
    const header = (tool.input?.header as string) ?? "";
    const placeholder = tool.input?.placeholder as string | undefined;
    const context = tool.input?.context as string | undefined;

    if (isComplete) {
      const answer = (tool.output?.answer as string) ?? "";
      return (
        <OpenQuestionCard
          key={key}
          question={question}
          header={header}
          placeholder={placeholder}
          context={context}
          disabled
          selectedAnswer={answer}
          onSubmit={() => {}}
        />
      );
    }

    if (question) {
      return (
        <OpenQuestionCard
          key={key}
          question={question}
          header={header}
          placeholder={placeholder}
          context={context}
          onSubmit={(answer) => onOpenAnswer?.(tool.toolCallId, answer)}
        />
      );
    }

    return (
      <ToolProgressCard
        key={key}
        icon={MessageCircleQuestion}
        label="Thinking"
      />
    );
  }

  if (tool.toolName === "proposeAndConfirm") {
    const header = (tool.input?.header as string) ?? "";
    const summary = (tool.input?.summary as string) ?? "";
    const reasoning = (tool.input?.reasoning as string) ?? "";
    const implications = (tool.input?.implications as string[] | undefined) ?? [];

    if (isComplete) {
      const out = tool.output as
        | { decision?: string; note?: string }
        | undefined;
      const decision = (out?.decision ?? "confirm") as ProposeConfirmAnswer["decision"];
      return (
        <ProposeConfirmCard
          key={key}
          header={header}
          summary={summary}
          reasoning={reasoning}
          implications={implications}
          disabled
          selectedAnswer={{ decision, note: out?.note }}
          onSubmit={() => {}}
        />
      );
    }

    // Render once summary is populated (reasoning + implications may still stream in)
    if (summary) {
      return (
        <ProposeConfirmCard
          key={key}
          header={header}
          summary={summary}
          reasoning={reasoning}
          implications={implications}
          onSubmit={(answer) => onProposeAnswer?.(tool.toolCallId, answer)}
        />
      );
    }

    return (
      <ToolProgressCard
        key={key}
        icon={Sparkles}
        label="Forming proposal"
      />
    );
  }

  if (tool.toolName === "webSearch") {
    const query = (tool.input?.query as string) ?? "";
    if (isComplete) {
      return (
        <div
          key={key}
          className="flex items-center gap-1.5 text-xs text-muted-foreground py-1"
        >
          <Globe className="h-3 w-3" />
          Searched: &ldquo;{query}&rdquo;
        </div>
      );
    }
    return (
      <ToolProgressCard
        key={key}
        icon={Globe}
        label="Researching"
        detail={query ? `"${query}"` : undefined}
      />
    );
  }

  if (tool.toolName === "readArtifact") {
    const artifactId = (tool.input?.artifactId as string) ?? "";
    if (isComplete) {
      const result = tool.output as { content?: string; error?: string };
      // Extract artifact label from the serialized content (e.g. ### [Plan] "Title")
      const match = result.content?.match(/\[(\w[\w ]*)\]\s*"([^"]+)"/);
      const label = match ? `${match[1]}: ${match[2]}` : artifactId;
      return (
        <div
          key={key}
          className="flex items-center gap-1.5 text-xs text-muted-foreground py-1"
        >
          <BookOpen className="h-3 w-3" />
          Read: {label}
        </div>
      );
    }
    return (
      <ToolProgressCard
        key={key}
        icon={BookOpen}
        label="Reading artifact"
        detail={artifactId || undefined}
      />
    );
  }

  if (tool.toolName === "readAllArtifacts") {
    if (isComplete) {
      const result = tool.output as { count?: number };
      return (
        <div
          key={key}
          className="flex items-center gap-1.5 text-xs text-muted-foreground py-1"
        >
          <BookOpen className="h-3 w-3" />
          Read all artifacts ({result.count ?? "?"})
        </div>
      );
    }
    return (
      <ToolProgressCard
        key={key}
        icon={BookOpen}
        label="Reading all artifacts"
      />
    );
  }

  if (tool.toolName === "refineFeatureDescription") {
    if (isComplete && tool.output) {
      const result = tool.output as {
        refinedDescription?: {
          featureTitle: string;
          parentPath: string[];
          description: string;
        };
      };
      if (result.refinedDescription) {
        return (
          <RefinedDescriptionCard
            key={key}
            data={result.refinedDescription}
            projectId={projectId}
          />
        );
      }
    }
    return (
      <ToolProgressCard
        key={key}
        icon={Sparkles}
        label="Refining description"
      />
    );
  }

  if (tool.toolName === "suggestPriorities") {
    if (isComplete && tool.output) {
      const result = tool.output as {
        priorityScores?: {
          featureTitle: string;
          parentPath: string[];
          reach: number;
          impact: number;
          confidence: number;
          effort: number;
          rationale: string;
        }[];
      };
      if (result.priorityScores) {
        return (
          <PriorityScoresCard
            key={key}
            scores={result.priorityScores}
            projectId={projectId}
          />
        );
      }
    }
    return (
      <ToolProgressCard
        key={key}
        icon={Sparkles}
        label="Scoring features"
      />
    );
  }

  if (tool.toolName === "updateRoadmap") {
    if (isComplete && tool.output) {
      const result = tool.output as {
        roadmapOperations?: {
          action: string;
          item: Partial<RoadmapItem> & { title?: string; id?: string };
        }[];
      };
      if (result.roadmapOperations) {
        return (
          <RoadmapOperationsCard
            key={key}
            operations={result.roadmapOperations}
            projectId={projectId}
          />
        );
      }
    }
    return (
      <ToolProgressCard
        key={key}
        icon={Sparkles}
        label="Updating roadmap"
      />
    );
  }

  if (tool.toolName === "editPlan" || tool.toolName === "editPRD") {
    return (
      <div key={key}>
        <EditToolBridge tool={tool} projectId={projectId} />
        {isComplete ? (
          <EditCompleteCard tool={tool} projectId={projectId} />
        ) : (
          <ToolProgressCard
            icon={Sparkles}
            label={tool.toolName === "editPlan" ? "Editing plan" : "Editing PRD"}
          />
        )}
      </div>
    );
  }

  if (tool.toolName in ARTIFACT_TOOL_LABELS) {
    if (isComplete && tool.output) {
      const result = tool.output as { artifact?: Artifact };
      if (result.artifact) {
        return (
          <div key={key} className="py-1">
            <ArtifactCard artifact={result.artifact} projectId={projectId} />
          </div>
        );
      }
    }
    return (
      <ToolProgressCard
        key={key}
        icon={Sparkles}
        label={ARTIFACT_TOOL_LABELS[tool.toolName]}
      />
    );
  }

  return null;
}

function EditToolBridge({
  tool,
  projectId,
}: {
  tool: ToolInfo;
  projectId: string;
}) {
  const startAiEdit = useWorkspaceContext((s) => s.startAiEdit);
  const updateAiEditContent = useWorkspaceContext((s) => s.updateAiEditContent);
  const completeAiEdit = useWorkspaceContext((s) => s.completeAiEdit);
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);
  const utils = trpc.useUtils();

  // AI SDK v6 tool part states: "input-streaming" → "input-available" → "output-available"
  const isComplete = tool.state === "output-available";
  const documentType = tool.toolName === "editPlan" ? ("plan" as const) : ("prd" as const);
  // During input-streaming, planId may be partially parsed. Prisma CUIDs are 25 chars.
  // Only use it once it looks complete to avoid capturing a truncated streaming ID.
  const rawDocumentId = (tool.input?.planId ?? tool.input?.prdId) as string | undefined;
  const documentId = rawDocumentId && rawDocumentId.length >= 24 && /^c[^\s-]{8,}$/i.test(rawDocumentId) ? rawDocumentId : undefined;
  const streamingContent = tool.input?.content as string | undefined;
  const didStart = useRef(false);
  const didComplete = useRef(false);
  // If the tool was already complete on first render, this is a restored message
  // from conversation history — skip all side effects to avoid re-triggering edits.
  const isRestored = useRef(isComplete);

  // Start edit session + navigate to document (when documentId first becomes available)
  // NOTE: Do NOT guard on isComplete — if the tool resolves before React processes
  // the streaming state, we still need to start the edit session for navigation.
  useEffect(() => {
    if (isRestored.current) return;
    if (!documentId || didStart.current) return;
    didStart.current = true;
    // Get pre-edit content from query cache for undo
    const list =
      documentType === "plan"
        ? utils.plan.list.getData({ projectId })
        : utils.prd.list.getData({ projectId });
    const doc = list?.find((d: { id: string }) => d.id === documentId);
    startAiEdit({
      documentType,
      documentId,
      preEditContent: (doc as { content?: string } | undefined)?.content ?? "",
    });
    setActiveView(documentType === "plan" ? "plan" : "prd", {
      type: documentType,
      id: documentId,
    });
  }, [documentId, documentType, projectId, startAiEdit, setActiveView, utils]);

  // Update streaming content as it grows (during input-streaming and input-available)
  useEffect(() => {
    if (isRestored.current) return;
    if (!isComplete && streamingContent != null && didStart.current) {
      updateAiEditContent(streamingContent);
    }
  }, [isComplete, streamingContent, updateAiEditContent]);

  // Complete: invalidate cache so editor picks up DB content
  useEffect(() => {
    if (isRestored.current) return;
    if (!isComplete || didComplete.current) return;
    didComplete.current = true;

    // If the edit session was started, complete it
    const aiEdit = useWorkspaceContext.getState().aiEdit;
    if (aiEdit && !aiEdit.isComplete) {
      completeAiEdit();
    }

    // Always invalidate cache to pick up the DB write from execute()
    if (documentType === "plan") {
      utils.plan.list.invalidate({ projectId });
    } else {
      utils.prd.list.invalidate({ projectId });
    }
  }, [isComplete, completeAiEdit, documentType, projectId, utils]);

  return null;
}

function EditCompleteCard({
  tool,
  projectId,
}: {
  tool: ToolInfo;
  projectId: string;
}) {
  const [undone, setUndone] = useState(false);
  const aiEdit = useWorkspaceContext((s) => s.aiEdit);
  const clearAiEdit = useWorkspaceContext((s) => s.clearAiEdit);
  const utils = trpc.useUtils();
  const planUpdate = trpc.plan.update.useMutation({
    onSuccess: () => utils.plan.list.invalidate({ projectId }),
  });
  const prdUpdate = trpc.prd.update.useMutation({
    onSuccess: () => utils.prd.list.invalidate({ projectId }),
  });

  // Snapshot undo data so it survives aiEdit being cleared by the view
  const undoRef = useRef<{ documentType: "plan" | "prd"; documentId: string; preEditContent: string } | null>(null);
  if (!undoRef.current && aiEdit) {
    undoRef.current = {
      documentType: aiEdit.documentType,
      documentId: aiEdit.documentId,
      preEditContent: aiEdit.preEditContent,
    };
  }

  const toolError = (tool.output as { status?: string; error?: string } | undefined)?.status === "error";
  const errorMessage = (tool.output as { error?: string } | undefined)?.error;

  const handleUndo = async () => {
    const undo = undoRef.current;
    if (!undo || undone) return;
    // Use documentId from tool output (guaranteed correct from execute) over snapshot
    // which may have captured a truncated streaming ID
    const output = tool.output as { documentId?: string } | undefined;
    const docId = output?.documentId ?? undo.documentId;
    if (!docId || !undo.preEditContent) return;
    if (undo.documentType === "plan") {
      await planUpdate.mutateAsync({ id: docId, content: undo.preEditContent });
    } else {
      await prdUpdate.mutateAsync({ id: docId, content: undo.preEditContent });
    }
    setUndone(true);
    clearAiEdit();
    toast.success("Edit undone");
  };

  if (toolError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 my-1">
        <Sparkles className="h-4 w-4 text-destructive" />
        <span className="text-xs font-medium flex-1 text-destructive">
          Edit failed{errorMessage ? `: ${errorMessage}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5 my-1">
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium flex-1">
        {undone ? "Edit undone" : "Document updated"}
      </span>
      {!undone && (
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleUndo}>
          Undo
        </Button>
      )}
    </div>
  );
}

function ToolProgressCard({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5 my-1">
      <div className="relative flex items-center justify-center">
        <span className="absolute h-6 w-6 rounded-full bg-primary/10 animate-ping" />
        <Icon className="h-4 w-4 text-primary relative z-10" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium flex items-center gap-1.5">
          {label}
          <span className="inline-flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </span>
        </div>
        {detail && (
          <p className="text-[11px] text-muted-foreground truncate">{detail}</p>
        )}
      </div>
    </div>
  );
}

function getUserText(message: { content?: string; parts?: { type: string; text?: string }[] }): string {
  const fromParts = message.parts
    ?.filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
  return fromParts || message.content || "";
}

// Render assistant chat text via react-markdown so the AI's GFM output
// (tables, italics, nested lists, blockquotes, strikethrough, etc.) renders
// correctly. The wrapping <div> uses Tailwind Typography prose classes that
// style the produced HTML; we only override links so they open safely in a
// new tab and route through sanitizeUrl.
function MessageMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ href, children, ...props }) => {
          const safe = href ? sanitizeUrl(href) : null;
          if (!safe) return <span>{children}</span>;
          return (
            <a
              {...props}
              href={safe}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          );
        },
        table: ({ children, ...props }) => (
          <div className="my-2 overflow-x-auto">
            <table {...props}>{children}</table>
          </div>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

type PriorityScore = {
  featureTitle: string;
  parentPath: string[];
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  rationale: string;
};

function applyScoresToTree(
  children: FeatureNode[],
  scores: PriorityScore[],
  parentTitles: string[] = [],
): FeatureNode[] {
  return children.map((node) => {
    const match = scores.find(
      (s) =>
        s.featureTitle === node.title &&
        JSON.stringify(s.parentPath) === JSON.stringify(parentTitles),
    );
    const updated = match
      ? {
          ...node,
          reach: match.reach,
          impact: match.impact,
          confidence: match.confidence,
          effort: match.effort,
        }
      : node;
    if (updated.children?.length) {
      return {
        ...updated,
        children: applyScoresToTree(updated.children, scores, [
          ...parentTitles,
          node.title,
        ]),
      };
    }
    return updated;
  });
}

function applyDescriptionToTree(
  children: FeatureNode[],
  featureTitle: string,
  parentPath: string[],
  description: string,
  currentPath: string[] = [],
  applied = { done: false },
): FeatureNode[] {
  return children.map((node) => {
    const pathMatch =
      JSON.stringify(currentPath) === JSON.stringify(parentPath);
    const titleMatch = node.title === featureTitle;
    const isExactMatch = titleMatch && pathMatch;
    const updated =
      isExactMatch && !applied.done
        ? ((applied.done = true), { ...node, description })
        : node;
    if (updated.children?.length) {
      return {
        ...updated,
        children: applyDescriptionToTree(
          updated.children,
          featureTitle,
          parentPath,
          description,
          [...currentPath, node.title],
          applied,
        ),
      };
    }
    return updated;
  });
}

function applyDescriptionFuzzy(
  children: FeatureNode[],
  featureTitle: string,
  description: string,
): FeatureNode[] {
  let found = false;
  function walk(nodes: FeatureNode[]): FeatureNode[] {
    return nodes.map((node) => {
      if (!found && node.title === featureTitle) {
        found = true;
        return {
          ...node,
          description,
          children: node.children ? walk(node.children) : undefined,
        };
      }
      return node.children?.length
        ? { ...node, children: walk(node.children) }
        : node;
    });
  }
  return walk(children);
}

function RefinedDescriptionCard({
  data,
  projectId,
}: {
  data: { featureTitle: string; parentPath: string[]; description: string };
  projectId: string;
}) {
  const [applied, setApplied] = useState(false);
  const { tree, syncTree } = useProjectFeatureTree(projectId);
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);

  const handleApply = async () => {
    if (!tree || applied) return;
    // Normalize parentPath — the AI may include rootFeature as the first element
    const normalizedPath =
      data.parentPath.length > 0 && data.parentPath[0] === tree.rootFeature
        ? data.parentPath.slice(1)
        : data.parentPath;
    const tracker = { done: false };
    let newChildren = applyDescriptionToTree(
      tree.children,
      data.featureTitle,
      normalizedPath,
      data.description,
      [],
      tracker,
    );
    if (!tracker.done) {
      newChildren = applyDescriptionFuzzy(
        tree.children,
        data.featureTitle,
        data.description,
      );
    }
    await syncTree({ rootFeature: tree.rootFeature, children: newChildren });
    setApplied(true);
  };

  const breadcrumb =
    data.parentPath.length > 0
      ? `${data.parentPath.join(" › ")} › `
      : "";

  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-3 my-1 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate">
          Description for{" "}
          <span className="text-muted-foreground">{breadcrumb}</span>
          {data.featureTitle}
        </span>
      </div>
      <div className="max-h-[200px] overflow-auto rounded border border-border/30 bg-background/50 p-2 text-xs whitespace-pre-wrap font-mono">
        {data.description}
      </div>
      <Button
        size="sm"
        variant={applied ? "outline" : "secondary"}
        className="h-7 text-xs w-full justify-center"
        onClick={() => {
          handleApply();
          setActiveView("features");
        }}
        disabled={!tree}
      >
        {applied ? "Applied — View Features" : "Apply Description"}
      </Button>
    </div>
  );
}

function PriorityScoresCard({ scores, projectId }: { scores: PriorityScore[]; projectId: string }) {
  const [applied, setApplied] = useState(false);
  const { tree, syncTree } = useProjectFeatureTree(projectId);
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);

  const handleApply = async () => {
    if (!tree || applied) return;
    // Normalize parentPaths — the AI may include the rootFeature (or the
    // original artifact root name) as the first element, but
    // applyScoresToTree builds paths starting from tree.children.
    // After DB round-trip, rootFeature may become "Feature Tree" when
    // there are multiple roots, so we also strip any leading element
    // that isn't a direct child title.
    const childTitles = new Set(tree.children.map((c) => c.title));
    const normalizedScores = scores.map((s) => ({
      ...s,
      parentPath:
        s.parentPath.length > 0 &&
        (s.parentPath[0] === tree.rootFeature || !childTitles.has(s.parentPath[0]))
          ? s.parentPath.slice(1)
          : s.parentPath,
    }));
    const newChildren = applyScoresToTree(tree.children, normalizedScores);
    await syncTree({ rootFeature: tree.rootFeature, children: newChildren });
    setApplied(true);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-3 my-1 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium">
          RICE Scores for {scores.length} feature{scores.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="max-h-[200px] overflow-auto text-xs space-y-1.5">
        {scores.slice(0, 8).map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="truncate text-muted-foreground">
              {s.parentPath.length > 0 && (
                <span className="opacity-60">{s.parentPath.join(" › ")} › </span>
              )}
              <span className="text-foreground">{s.featureTitle}</span>
            </span>
            <span className="shrink-0 tabular-nums font-medium">
              {((s.reach * s.impact * (s.confidence / 100)) / s.effort).toFixed(1)}
            </span>
          </div>
        ))}
        {scores.length > 8 && (
          <div className="text-muted-foreground">+{scores.length - 8} more</div>
        )}
      </div>
      <Button
        size="sm"
        variant={applied ? "outline" : "secondary"}
        className="h-7 text-xs w-full justify-center"
        onClick={() => {
          handleApply();
          setActiveView("priorities");
        }}
        disabled={!tree}
      >
        {applied ? "View in Priorities" : "Apply Scores to Feature Tree"}
      </Button>
    </div>
  );
}

type RoadmapOp = {
  action: string;
  item: Partial<RoadmapItem> & { title?: string; id?: string };
};

function RoadmapOperationsCard({ operations, projectId }: { operations: RoadmapOp[]; projectId: string }) {
  const [applied, setApplied] = useState(false);
  const { roadmap, syncRoadmap } = useProjectRoadmap(projectId);
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);

  const handleApply = async () => {
    if (!roadmap || applied) return;
    let newItems = [...roadmap.items];

    for (const op of operations) {
      if (op.action === "add" && op.item.title) {
        newItems.push({
          id: op.item.id || generateId(),
          title: op.item.title,
          description: op.item.description,
          laneId: op.item.laneId || roadmap.lanes[0]?.id || "",
          startDate: op.item.startDate || new Date().toISOString().slice(0, 10),
          endDate: op.item.endDate || new Date().toISOString().slice(0, 10),
          status: (op.item.status as RoadmapItem["status"]) || "not_started",
          type: (op.item.type as RoadmapItem["type"]) || "feature",
        });
      } else if (op.action === "update") {
        const idx = newItems.findIndex(
          (it) => it.id === op.item.id || it.title === op.item.title,
        );
        if (idx >= 0) {
          newItems[idx] = { ...newItems[idx], ...op.item, id: newItems[idx].id } as RoadmapItem;
        }
      } else if (op.action === "remove") {
        newItems = newItems.filter(
          (it) => it.id !== op.item.id && it.title !== op.item.title,
        );
      }
    }

    const merged: RoadmapArtifact & { id: string } = { ...roadmap, items: newItems };
    const input = artifactToSyncInput(merged);
    await syncRoadmap({ roadmapId: roadmap.id, ...input });
    setApplied(true);
  };

  const addCount = operations.filter((o) => o.action === "add").length;
  const updateCount = operations.filter((o) => o.action === "update").length;
  const removeCount = operations.filter((o) => o.action === "remove").length;
  const parts: string[] = [];
  if (addCount) parts.push(`${addCount} add`);
  if (updateCount) parts.push(`${updateCount} update`);
  if (removeCount) parts.push(`${removeCount} remove`);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-3 my-1 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium">
          Roadmap Changes ({parts.join(", ")})
        </span>
      </div>
      <div className="max-h-[200px] overflow-auto text-xs space-y-1.5">
        {operations.slice(0, 8).map((op, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={cn(
              "shrink-0 text-[10px] font-medium uppercase px-1 rounded",
              op.action === "add" && "text-green-400 bg-green-400/10",
              op.action === "update" && "text-blue-400 bg-blue-400/10",
              op.action === "remove" && "text-red-400 bg-red-400/10",
            )}>
              {op.action}
            </span>
            <span className="truncate text-foreground">
              {op.item.title || op.item.id}
            </span>
          </div>
        ))}
        {operations.length > 8 && (
          <div className="text-muted-foreground">+{operations.length - 8} more</div>
        )}
      </div>
      <Button
        size="sm"
        variant={applied ? "outline" : "secondary"}
        className="h-7 text-xs w-full justify-center"
        onClick={() => {
          handleApply();
          setActiveView("roadmap");
        }}
        disabled={!roadmap}
      >
        {applied ? "View Roadmap" : "Apply Changes"}
      </Button>
    </div>
  );
}
