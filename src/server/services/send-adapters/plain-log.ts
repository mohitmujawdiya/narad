import type { SendAdapter } from "./types";

export const plainLogAdapter: SendAdapter = {
  id: "plain-log",
  label: "Already sent (just log it)",
  async send() {
    return { kind: "logged", sentAt: new Date() };
  },
};
