"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Inbox } from "lucide-react";

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild className="w-full justify-start">
          <Link href="/pursuits/new"><Plus className="size-4" /> New pursuit</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/inbox"><Inbox className="size-4" /> Check inbox</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
