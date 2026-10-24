import { m } from "@/paraglide/messages.js";

import { code, messageParts, strong } from "../lib/message-parts";
import { RichText } from "./rich-text";

const TEST_BANK = "Connecteur de test";
const TEST_BANK_PASSWORD = "1234";

export const PowensSandboxNote = () => (
  <p className="text-muted-foreground text-sm break-words">
    <RichText
      parts={messageParts(m.setup_powens_sandbox_note, {
        bank: strong(TEST_BANK),
        password: code(TEST_BANK_PASSWORD),
      })}
    />
  </p>
);
