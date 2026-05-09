"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplatePicker } from "./template-picker";

type Channel = "email" | "linkedin";

export type DraftValue = {
  channel: Channel;
  templateId: string | null;
  subject: string | null;
  body: string;
};

export function MessageEditor({ value, onChange }: { value: DraftValue; onChange: (v: DraftValue) => void }) {
  const [charCount, setCharCount] = useState(value.body.length);

  useEffect(() => {
    setCharCount(value.body.length);
  }, [value.body]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Channel</Label>
          <select
            className="border rounded-md h-9 px-2"
            value={value.channel}
            onChange={(e) => onChange({ ...value, channel: e.target.value as Channel, subject: e.target.value === "email" ? value.subject : null })}
          >
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Template</Label>
          <TemplatePicker
            channel={value.channel}
            value={value.templateId}
            onChange={(tpl, body, subject) => onChange({ ...value, templateId: tpl, body, subject })}
          />
        </div>
      </div>

      {value.channel === "email" && (
        <div className="space-y-1">
          <Label>Subject</Label>
          <Input value={value.subject ?? ""} onChange={(e) => onChange({ ...value, subject: e.target.value })} />
        </div>
      )}

      <div className="space-y-1">
        <Label>Body</Label>
        <Textarea
          rows={value.channel === "linkedin" ? 5 : 12}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {charCount} chars
          {value.channel === "linkedin" && (
            <span className={charCount > 300 ? "text-destructive" : ""}> / 300 LinkedIn limit</span>
          )}
        </p>
      </div>
    </div>
  );
}
