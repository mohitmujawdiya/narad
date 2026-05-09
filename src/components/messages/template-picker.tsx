"use client";

import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TemplatePicker({
  channel,
  value,
  onChange,
}: {
  channel: "email" | "linkedin";
  value: string | null;
  onChange: (templateId: string | null, body: string, subject: string | null) => void;
}) {
  const templates = trpc.templates.list.useQuery({ channel });

  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => {
        if (v === "none") {
          onChange(null, "", null);
        } else {
          const t = templates.data?.find((x) => x.id === v);
          if (t) onChange(t.id, t.body, t.subject);
        }
      }}
    >
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Pick template…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No template</SelectItem>
        {templates.data?.map((t) => (
          <SelectItem key={t.id} value={t.id}>{t.name} · {t.contactType}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
