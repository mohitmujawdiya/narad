import type { Touchpoint, Message, Contact, Profile } from "@prisma/client";

export type SendInput = {
  touchpoint: Touchpoint;
  message: Message;
  contact: Contact;
  profile: Profile;
};

export type SendResult =
  | { kind: "sent"; externalId: string | null; sentAt: Date; meta?: Record<string, unknown> }
  | { kind: "queued-for-manual"; instructions: string; mailtoUrl?: string; copyToClipboard?: string; openUrl?: string }
  | { kind: "logged"; sentAt: Date }
  | { kind: "failed"; error: string };

export interface SendAdapter {
  readonly id: "gmail" | "mailto" | "clipboard" | "plain-log";
  readonly label: string;
  send(input: SendInput): Promise<SendResult>;
}
