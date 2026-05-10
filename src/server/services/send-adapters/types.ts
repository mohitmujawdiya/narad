import type { Pursuit, Profile } from "@prisma/client";

export type SendInput = {
  pursuit: Pursuit;
  profile: Profile;
};

export type SendResult =
  | { kind: "sent"; externalId: string | null; sentAt: Date }
  | {
      kind: "queued-for-manual";
      instructions: string;
      mailtoUrl?: string;
      copyToClipboard?: string;
      openUrl?: string;
    }
  | { kind: "logged"; sentAt: Date }
  | { kind: "failed"; error: string };

export type AdapterId = "gmail" | "mailto" | "clipboard" | "plain-log";

export interface SendAdapter {
  readonly id: AdapterId;
  readonly label: string;
  send(input: SendInput): Promise<SendResult>;
}
