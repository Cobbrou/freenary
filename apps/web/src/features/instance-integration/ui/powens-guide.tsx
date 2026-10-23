import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { Data, Effect } from "effect";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";

import { code, link, messageParts, strong } from "../lib/message-parts";
import { POWENS_CLIENT_APPLICATIONS } from "../model/labels";
import { providerRedirectUrl } from "../model/redirect-url";
import { RichText } from "./rich-text";

const POWENS = "powens";
const POWENS_REGISTER_URL = "https://console.powens.com/auth/register";
const POWENS_ADD_CLIENT = "Add a client";
const POWENS_DOMAIN_SUFFIX = "-sandbox";
const EXAMPLE_NAME = "acme";
const EXAMPLE_DOMAIN = `${EXAMPLE_NAME}${POWENS_DOMAIN_SUFFIX}`;
const TEST_BANK = "Connecteur de test";
const TEST_BANK_PASSWORD = "1234";

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

export const PowensGuide = () => {
  const CopyIcon = useIcon("copy");
  const origin = useBrowserOrigin();
  const redirectUrl =
    origin === null ? null : providerRedirectUrl(origin, POWENS);

  return (
    <div className="flex flex-col gap-4">
      <ol
        aria-label={m.setup_powens_guide_label()}
        className="text-muted-foreground flex list-decimal flex-col gap-2 ps-5 text-sm break-words"
      >
        <li>
          <RichText
            parts={messageParts(m.setup_powens_guide_account, {
              console: link(
                m.setup_powens_guide_console_link(),
                POWENS_REGISTER_URL
              ),
            })}
          />
        </li>
        <li>
          <RichText
            parts={messageParts(m.setup_powens_guide_domain, {
              domain: code(EXAMPLE_DOMAIN),
              name: code(EXAMPLE_NAME),
              suffix: code(POWENS_DOMAIN_SUFFIX),
            })}
          />
        </li>
        <li>
          <RichText
            parts={messageParts(m.setup_powens_guide_client, {
              action: strong(POWENS_ADD_CLIENT),
              section: strong(POWENS_CLIENT_APPLICATIONS),
            })}
          />
        </li>
        <li>{m.setup_powens_guide_credentials()}</li>
        <li>{m.setup_powens_guide_connectors()}</li>
      </ol>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{m.setup_redirect_url_label()}</p>
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
    </div>
  );
};

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
