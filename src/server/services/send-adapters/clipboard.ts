import type { SendAdapter, SendInput, SendResult } from "./types";

function formatForClipboard(input: SendInput): string {
  const { pursuit } = input;
  const channel = pursuit.outreachChannel;
  const lines: string[] = [];

  if (channel === "linkedin") {
    if (pursuit.contactLinkedinUrl) {
      lines.push(`To: ${pursuit.contactLinkedinUrl}`);
      lines.push("");
    }
    lines.push("Body:");
    lines.push(pursuit.outreachBody ?? "");
    return lines.join("\n");
  }

  // Default: email-style
  if (pursuit.outreachSubject) {
    lines.push(`Subject: ${pursuit.outreachSubject}`);
    lines.push("");
  }
  lines.push("Body:");
  lines.push(pursuit.outreachBody ?? "");
  if (pursuit.contactEmail) {
    lines.push("");
    lines.push(`To: ${pursuit.contactEmail}`);
  }
  return lines.join("\n");
}

async function send(input: SendInput): Promise<SendResult> {
  const { pursuit } = input;
  if (!pursuit.outreachBody) {
    return { kind: "failed", error: "Pursuit has no outreachBody to copy." };
  }

  const formatted = formatForClipboard(input);
  const result: SendResult = {
    kind: "queued-for-manual",
    instructions: "Paste into your channel of choice.",
    copyToClipboard: formatted,
  };

  if (pursuit.outreachChannel === "linkedin" && pursuit.contactLinkedinUrl) {
    result.openUrl = pursuit.contactLinkedinUrl;
  }

  return result;
}

export const clipboardAdapter: SendAdapter = {
  id: "clipboard",
  label: "Copy to clipboard",
  send,
};
