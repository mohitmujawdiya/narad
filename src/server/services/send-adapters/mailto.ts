import type { SendAdapter, SendInput, SendResult } from "./types";

async function send(input: SendInput): Promise<SendResult> {
  const { pursuit } = input;

  if (!pursuit.contactEmail) {
    return {
      kind: "failed",
      error: "Pursuit has no contactEmail; cannot build mailto URL.",
    };
  }
  if (!pursuit.outreachBody) {
    return { kind: "failed", error: "Pursuit has no outreachBody to send." };
  }

  const subject = pursuit.outreachSubject ?? "";
  const body = pursuit.outreachBody;
  const mailtoUrl = `mailto:${pursuit.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    kind: "queued-for-manual",
    instructions: "Click to open in your default mail client.",
    mailtoUrl,
  };
}

export const mailtoAdapter: SendAdapter = {
  id: "mailto",
  label: "Open in mail client (mailto:)",
  send,
};
