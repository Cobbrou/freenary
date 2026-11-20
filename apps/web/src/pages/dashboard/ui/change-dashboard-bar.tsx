import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import { Button } from "@freenary/ui/components/button";
import { RiCloseLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";

import { assistantErrorMessage } from "@/features/assistant-chat";
import { m } from "@/paraglide/messages.js";

import { useDashboardChange } from "../model/use-dashboard-change";

interface ChangeDashboardBarProps {
  conversationId: string | null;
  dashboardId: string;
  serverModel: string | null;
}

export const ChangeDashboardBar = ({
  conversationId,
  dashboardId,
  serverModel,
}: ChangeDashboardBarProps) => {
  const [instruction, setInstruction] = useState("");
  const [dismissedReply, setDismissedReply] = useState("");
  const inputId = useId();
  const { chatId, error, model, reply, requestChange, working } =
    useDashboardChange({ conversationId, dashboardId, serverModel });

  const trimmed = instruction.trim();
  const unavailable = model.selected === null;
  const showReply = !working && reply.length > 0 && reply !== dismissedReply;

  return (
    <div className="pointer-events-none sticky bottom-4 z-10 mx-auto flex w-full max-w-xl flex-col gap-2">
      {showReply ? (
        <div
          aria-live="polite"
          className="bg-popover text-popover-foreground pointer-events-auto flex items-start gap-3 rounded-xl border p-3 text-sm shadow-lg"
        >
          <BrandAvatar className="size-6 shrink-0" frozen state="happy" />
          <p className="line-clamp-4 min-w-0 flex-1 text-pretty whitespace-pre-line">
            {reply}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {chatId ? (
              <Button
                render={
                  <Link
                    params={{ conversationId: chatId }}
                    to="/ask/$conversationId"
                  />
                }
                size="compact"
                variant="ghost"
              >
                {m.dashboard_change_open_chat()}
              </Button>
            ) : null}
            <Button
              aria-label={m.dashboard_change_dismiss()}
              onClick={() => setDismissedReply(reply)}
              size="icon-compact"
              type="button"
              variant="ghost"
            >
              <RiCloseLine />
            </Button>
          </div>
        </div>
      ) : null}
      {error && !working ? (
        <p
          className="bg-popover text-destructive pointer-events-auto rounded-xl border p-3 text-sm shadow-lg"
          role="alert"
        >
          {assistantErrorMessage(error.message)}
        </p>
      ) : null}
      <form
        className="bg-popover focus-within:ring-ring/50 pointer-events-auto flex items-center gap-2 rounded-xl border p-1.5 ps-3 shadow-lg focus-within:ring-[3px]"
        onSubmit={(event) => {
          event.preventDefault();

          if (trimmed.length > 0 && !working) {
            requestChange(trimmed);
            setInstruction("");
          }
        }}
      >
        <BrandAvatar
          className="size-6 shrink-0"
          state={working ? "thinking" : "idle"}
        />
        <label className="sr-only" htmlFor={inputId}>
          {m.dashboard_change_label()}
        </label>
        <input
          autoComplete="off"
          className="placeholder:text-muted-foreground h-8 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          disabled={unavailable}
          id={inputId}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={
            unavailable
              ? m.dashboard_change_unavailable()
              : m.dashboard_change_placeholder()
          }
          value={instruction}
        />
        <Button
          disabled={unavailable || trimmed.length === 0}
          loading={working}
          size="compact"
          type="submit"
        >
          {working ? m.dashboard_change_working() : m.dashboard_change_submit()}
        </Button>
      </form>
    </div>
  );
};
