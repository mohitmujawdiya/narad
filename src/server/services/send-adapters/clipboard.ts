import type { SendAdapter } from "./types";

export const clipboardAdapter: SendAdapter = {
  id: "clipboard",
  label: "LinkedIn (copy + open profile)",
  async send({ message, contact }) {
    if (!contact.linkedinUrl) {
      return { kind: "failed", error: "Contact has no LinkedIn URL" };
    }

    return {
      kind: "queued-for-manual",
      instructions: `Message copied to clipboard. LinkedIn profile opens in a new tab. Paste into the message field and send.`,
      copyToClipboard: message.body,
      openUrl: contact.linkedinUrl,
    };
  },
};
