import type { SendAdapter, SendInput, SendResult } from "./types";

async function send(_input: SendInput): Promise<SendResult> {
  return { kind: "logged", sentAt: new Date() };
}

export const plainLogAdapter: SendAdapter = {
  id: "plain-log",
  label: "Plain log (simulated send)",
  send,
};
