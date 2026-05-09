"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Company = {
  id: string;
  name: string;
  domain: string | null;
  sector: string | null;
  fitScore: number | null;
  _count?: { contacts: number };
};

function CardChrome({
  company,
  className,
  gripProps,
  innerRef,
}: {
  company: Company;
  className?: string;
  gripProps?: React.HTMLAttributes<HTMLButtonElement>;
  innerRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={innerRef}
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm transition-shadow",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...gripProps}
          className="text-muted-foreground -ml-1 cursor-grab focus:outline-none"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link
            href={`/companies/${company.id}`}
            className="font-medium text-sm hover:underline truncate block"
          >
            {company.name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">
            {company.domain ?? "no domain"}
            {company.sector ? ` · ${company.sector}` : ""}
          </p>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            {company._count?.contacts !== undefined && (
              <span>
                {company._count.contacts} contact{company._count.contacts === 1 ? "" : "s"}
              </span>
            )}
            {company.fitScore !== null && <span>fit {company.fitScore}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Draggable card rendered inside a column. While being dragged, this card stays
 * in place with reduced opacity (the DragOverlay clone follows the cursor).
 */
export function CompanyCard({ company }: { company: Company }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: company.id,
    data: company,
  });

  return (
    <CardChrome
      company={company}
      innerRef={setNodeRef}
      gripProps={{ ...listeners, ...attributes }}
      className={cn("hover:shadow-md", isDragging && "opacity-30")}
    />
  );
}

/**
 * Static clone rendered inside DragOverlay. No drag wiring — DragOverlay handles
 * positioning. Slightly tilted + heavier shadow to read as "lifted".
 */
export function CompanyCardOverlay({ company }: { company: Company }) {
  return (
    <CardChrome
      company={company}
      className="shadow-2xl rotate-2 cursor-grabbing"
    />
  );
}
