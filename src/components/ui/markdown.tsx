"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

/**
 * Reusable markdown renderer. Used wherever we show text bodies that may
 * contain markdown (AI research outputs, notes, evaluation reports in
 * Phase B, cover letter previews, story content, etc.).
 *
 * Why not just dangerouslySetInnerHTML: we sanitize via rehype-sanitize
 * because some text bodies originate from AI and could contain unintended
 * HTML. GFM enables tables, strikethrough, task lists, autolinks.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm max-w-none text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto -mx-1 my-3">
              <table {...props} className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead {...props} className="bg-muted/60">{children}</thead>
          ),
          th: ({ children, ...props }) => (
            <th {...props} className="border border-border px-2 py-1.5 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td {...props} className="border border-border px-2 py-1.5 align-top">
              {children}
            </td>
          ),
          a: ({ children, href, ...props }) => (
            <a
              {...props}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2 hover:no-underline break-words"
            >
              {children}
            </a>
          ),
          code: ({ children, className: codeClass, ...props }) => {
            const inline = !codeClass; // markdown code blocks have language- class; inline don't
            if (inline) {
              return (
                <code {...props} className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">
                  {children}
                </code>
              );
            }
            return <code {...props} className={codeClass}>{children}</code>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
