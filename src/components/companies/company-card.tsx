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

export function CompanyCard({ company, isDragging }: { company: Company; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: company.id,
    data: company,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="text-muted-foreground -ml-1 cursor-grab">
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link href={`/companies/${company.id}`} className="font-medium text-sm hover:underline truncate block">
            {company.name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">
            {company.domain ?? "no domain"}
            {company.sector ? ` · ${company.sector}` : ""}
          </p>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            {company._count?.contacts !== undefined && (
              <span>{company._count.contacts} contact{company._count.contacts === 1 ? "" : "s"}</span>
            )}
            {company.fitScore !== null && <span>fit {company.fitScore}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
