import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { Data, Effect } from "effect";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";

import type { MessagePart } from "../lib/message-parts";
import { providerRedirectUrl } from "../model/redirect-url";
import { RichText } from "./rich-text";

class ClipboardWriteRefused extends Data.TaggedError("ClipboardWriteRefused")<{
  readonly cause: unknown;
}> {}

const copyRedirectUrl = (url: string) =>
  Effect.tryPromise({
    catch: (cause) => new ClipboardWriteRefused({ cause }),
    try: () => navigator.clipboard.writeText(url),
  }).pipe(
    Effect.andThen(
      Effect.sync(() => {
        toast.success(m.setup_redirect_url_copied());
      })
    ),
    Effect.catchTag("ClipboardWriteRefused", () =>
      Effect.sync(() => {
        toast.error(m.setup_redirect_url_copy_error());
      })
    )
  );

const unsubscribeFromNothing = () => null;
const subscribeToNothing = () => unsubscribeFromNothing;
const browserOrigin = (): string | null => window.location.origin;
const noOriginOnServer = (): string | null => null;

const useBrowserOrigin = (): string | null =>
  useSyncExternalStore(subscribeToNothing, browserOrigin, noOriginOnServer);

interface RedirectUrlBoxProps {
  help: readonly MessagePart[] | null;
  provider: string;
}

export const RedirectUrlBox = ({ help, provider }: RedirectUrlBoxProps) => {
  const CopyIcon = useIcon("copy");
  const origin = useBrowserOrigin();
  const redirectUrl =
    origin === null ? null : providerRedirectUrl(origin, provider);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs/relaxed font-medium">
        {m.setup_redirect_url_label()}
      </p>
      {help === null ? null : (
        <p className="text-muted-foreground text-sm break-words">
          <RichText parts={help} />
        </p>
      )}
      <div className="ring-border flex items-center gap-2 rounded-lg py-1.5 ps-3 pe-1.5 ring-1">
        <code className="min-h-5 min-w-0 flex-1 font-mono text-sm break-all select-all">
          {redirectUrl}
        </code>
        <Button
          aria-label={m.setup_redirect_url_copy_label()}
          disabled={redirectUrl === null}
          leadingIcon={CopyIcon}
          onClick={() => {
            if (redirectUrl !== null) {
              void Effect.runPromise(copyRedirectUrl(redirectUrl));
            }
          }}
          size="compact"
          type="button"
          variant="tertiary"
        >
          {m.setup_redirect_url_copy()}
        </Button>
      </div>
    </div>
  );
};
