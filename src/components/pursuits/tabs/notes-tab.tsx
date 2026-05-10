"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";

export function NotesTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const utils = trpc.useUtils();

  // Reset local state whenever the server-side notes change underneath us.
  // Using `pursuit.id + updatedAt` as the key forces a remount on incoming
  // server updates without an effect that calls setState.
  return (
    <NotesTabInner
      key={`${pursuit.id}:${new Date(pursuit.updatedAt).getTime()}`}
      pursuit={pursuit}
      utils={utils}
    />
  );
}

function NotesTabInner({
  pursuit,
  utils,
}: {
  pursuit: PursuitWithDecodedJson;
  utils: ReturnType<typeof trpc.useUtils>;
}) {
  const initial = pursuit.notes ?? "";
  const [value, setValue] = useState(initial);

  const update = trpc.pursuits.update.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const dirty = value !== initial;

  function save() {
    update.mutate({ id: pursuit.id, data: { notes: value } });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Notes</CardTitle>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (dirty && !update.isPending) save();
          }}
          rows={16}
          placeholder="Free-form notes — markdown OK."
          className="font-sans text-sm"
        />
      </CardContent>
    </Card>
  );
}
