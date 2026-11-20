import { Button } from "@freenary/ui/components/button";
import { RiArrowUpLine } from "@remixicon/react";
import { useId, useState } from "react";

import { m } from "@/paraglide/messages.js";

interface HomeAskFormProps {
  isStarting: boolean;
  onAsk: (question: string) => void;
}

export const HomeAskForm = ({ isStarting, onAsk }: HomeAskFormProps) => {
  const [question, setQuestion] = useState("");
  const inputId = useId();
  const trimmed = question.trim();

  return (
    <form
      className="bg-card focus-within:ring-ring/50 flex w-full items-center gap-2 rounded-xl border p-1.5 ps-4 shadow-xs focus-within:ring-[3px]"
      onSubmit={(event) => {
        event.preventDefault();

        if (trimmed.length > 0) {
          onAsk(trimmed);
        }
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {m.home_ask_label()}
      </label>
      <input
        autoComplete="off"
        className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        id={inputId}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={m.home_ask_placeholder()}
        value={question}
      />
      <Button
        aria-label={m.assistant_send()}
        disabled={trimmed.length === 0}
        loading={isStarting}
        size="icon"
        type="submit"
      >
        <RiArrowUpLine />
      </Button>
    </form>
  );
};
