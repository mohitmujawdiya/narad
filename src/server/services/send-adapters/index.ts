import { mailtoAdapter } from "./mailto";
import { clipboardAdapter } from "./clipboard";
import { plainLogAdapter } from "./plain-log";

export const ADAPTERS = {
  mailto: mailtoAdapter,
  clipboard: clipboardAdapter,
  "plain-log": plainLogAdapter,
} as const;

export * from "./types";
