"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Building2, Inbox } from "lucide-react";

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild className="w-full justify-start">
          <Link href="/sources"><Sparkles className="size-4" /> Bulk import companies</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/companies/new"><Building2 className="size-4" /> Add single company</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/inbox"><Inbox className="size-4" /> Check inbox</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
