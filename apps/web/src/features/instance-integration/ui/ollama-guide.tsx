import { m } from "@/paraglide/messages.js";

import { code, link, messageParts } from "../lib/message-parts";
import { RichText } from "./rich-text";

const OLLAMA = "Ollama";
const OLLAMA_URL = "https://ollama.com";
const OLLAMA_PULL_COMMAND = "ollama pull qwen3:4b-instruct-2507-q4_K_M";
const SAME_NETWORK_URL = "http://ollama:11434/v1";
const HOST_URL = "http://host.docker.internal:11434/v1";
const LOCALHOST = "localhost";

export const OllamaGuide = () => (
  <ol
    aria-label={m.setup_ollama_guide_label()}
    className="text-muted-foreground flex list-decimal flex-col gap-2 ps-5 text-sm break-words"
  >
    <li>
      <RichText
        parts={messageParts(m.setup_ollama_guide_install, {
          ollama: link(OLLAMA, OLLAMA_URL),
        })}
      />
    </li>
    <li>
      <RichText
        parts={messageParts(m.setup_ollama_guide_pull, {
          command: code(OLLAMA_PULL_COMMAND),
        })}
      />
    </li>
    <li>
      <RichText
        parts={messageParts(m.setup_ollama_guide_endpoint, {
          host: code(HOST_URL),
          network: code(SAME_NETWORK_URL),
        })}
      />{" "}
      <RichText
        parts={messageParts(m.setup_ollama_guide_localhost, {
          localhost: code(LOCALHOST),
        })}
      />
    </li>
  </ol>
);

export const OllamaNote = () => (
  <p className="text-muted-foreground text-sm break-words">
    {m.setup_variant_ollama_tradeoffs()}
  </p>
);
