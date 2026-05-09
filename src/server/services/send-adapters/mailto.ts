import type { SendAdapter } from "./types";

export const mailtoAdapter: SendAdapter = {
  id: "mailto",
  label: "Email (open in mail client)",
  async send({ message, contact }) {
    if (!contact.email) {
      return { kind: "failed", error: "Contact has no email" };
    }
    const params = new URLSearchParams();
    if (message.subject) params.set("subject", message.subject);
    params.set("body", message.body);
    const mailtoUrl = `mailto:${contact.email}?${params.toString()}`;

    return {
      kind: "queued-for-manual",
      instructions: `Mail client opens with prefilled draft to ${contact.email}. Click Send in your client. Then come back and confirm sent.`,
      mailtoUrl,
    };
  },
};
