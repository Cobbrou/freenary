import { m } from "@/paraglide/messages.js";

import { code, messageParts, strong } from "../lib/message-parts";
import { RichText } from "./rich-text";

const OLLAMA_URL = "http://ollama:11434/v1";
const OLLAMA_MODEL = "qwen3:4b-instruct-2507-q4_K_M";

export const EndpointClassifierGuide = () => (
  <div className="text-muted-foreground flex flex-col gap-2 text-sm break-words">
    <p>{m.setup_endpoint_classifier_privacy()}</p>
    <p>
      <RichText
        parts={messageParts(m.setup_endpoint_classifier_ollama_hint, {
          title: strong(m.setup_endpoint_classifier_ollama_title()),
        })}
      />
    </p>
    <details className="flex flex-col gap-2">
      <summary className="hover:text-foreground cursor-pointer select-none">
        {m.setup_more_details()}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <p>
          <RichText
            parts={messageParts(m.setup_endpoint_classifier_ollama_details, {
              model: code(OLLAMA_MODEL),
              url: code(OLLAMA_URL),
            })}
          />
        </p>
        <p>{m.setup_endpoint_classifier_suggest_only()}</p>
      </div>
    </details>
  </div>
);
