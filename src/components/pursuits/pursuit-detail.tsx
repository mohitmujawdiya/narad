"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";
import { PursuitHeader } from "./pursuit-header";
import { OverviewTab } from "./tabs/overview-tab";
import { ResearchTab } from "./tabs/research-tab";
import { JdTab } from "./tabs/jd-tab";
import { CvTab } from "./tabs/cv-tab";
import { CoverLetterTab } from "./tabs/cover-letter-tab";
import { OutreachTab } from "./tabs/outreach-tab";
import { FollowUpsTab } from "./tabs/follow-ups-tab";
import { NotesTab } from "./tabs/notes-tab";

export function PursuitDetail({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const isJob = pursuit.type === "job";
  const showJdTab = isJob && pursuit.jdMarkdown !== null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <PursuitHeader pursuit={pursuit} />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          {showJdTab && <TabsTrigger value="jd">JD</TabsTrigger>}
          {isJob && <TabsTrigger value="cv">CV</TabsTrigger>}
          {isJob && <TabsTrigger value="cover-letter">Cover letter</TabsTrigger>}
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab pursuit={pursuit} />
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          <ResearchTab pursuit={pursuit} />
        </TabsContent>

        {showJdTab && (
          <TabsContent value="jd" className="mt-4">
            <JdTab pursuit={pursuit} />
          </TabsContent>
        )}

        {isJob && (
          <TabsContent value="cv" className="mt-4">
            <CvTab pursuit={pursuit} />
          </TabsContent>
        )}

        {isJob && (
          <TabsContent value="cover-letter" className="mt-4">
            <CoverLetterTab pursuit={pursuit} />
          </TabsContent>
        )}

        <TabsContent value="outreach" className="mt-4">
          <OutreachTab pursuit={pursuit} />
        </TabsContent>

        <TabsContent value="follow-ups" className="mt-4">
          <FollowUpsTab pursuit={pursuit} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <NotesTab pursuit={pursuit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
