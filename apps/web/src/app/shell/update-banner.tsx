import { Button } from "@freenary/ui/components/button";
import { RiCloseLine, RiExternalLinkLine } from "@remixicon/react";
import type { RefObject } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { releaseNotesUrl, updateGuideUrl } from "@/shared/config";

import {
  dismissUpdate,
  isBannerShown,
  useDismissedUpdate,
} from "./update-dismissal";

const NewTabLink = ({ href, label }: { href: string; label: string }) => (
  <a
    className="focus-visible:ring-foreground inline-flex min-h-6 items-center gap-1 rounded-sm font-medium underline underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-2"
    href={href}
    rel="noopener noreferrer"
    target="_blank"
  >
    {label}
    <RiExternalLinkLine aria-hidden="true" className="size-3.5 shrink-0" />
    <span className="sr-only">{m.update_banner_new_tab()}</span>
  </a>
);

const CONTENT_HEADER_CONTROL = "main > header button, main > header a";

const focusPastTheBanner = (banner: HTMLElement | null) => {
  const next = banner?.parentElement?.querySelector<HTMLElement>(
    CONTENT_HEADER_CONTROL
  );

  next?.focus();
};

const BANNER_HEIGHT_VARIABLE = "--update-banner-height";

const usePublishedHeight = (banner: RefObject<HTMLElement | null>): void => {
  useLayoutEffect(() => {
    const element = banner.current;
    const root = document.documentElement;

    if (element === null) {
      return;
    }

    const publish = () => {
      root.style.setProperty(
        BANNER_HEIGHT_VARIABLE,
        `${element.getBoundingClientRect().height}px`
      );
    };

    publish();

    const observer = new ResizeObserver(publish);

    observer.observe(element);

    return () => {
      observer.disconnect();
      root.style.removeProperty(BANNER_HEIGHT_VARIABLE);
    };
  }, [banner]);
};

const useRevealed = (): boolean => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRevealed(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return revealed;
};

const Banner = ({ latest }: { latest: string }) => {
  const headingId = useId();
  const reveal = useRef<HTMLDivElement>(null);
  const revealed = useRevealed();

  usePublishedHeight(reveal);

  return (
    <div
      className="grid shrink-0 grid-rows-[0fr] transition-[grid-template-rows] duration-150 ease-out data-[revealed]:grid-rows-[1fr] motion-reduce:transition-none md:sticky md:top-0 md:z-30"
      data-revealed={revealed || undefined}
      ref={reveal}
    >
      <div className="min-h-0 overflow-hidden">
        <section
          aria-labelledby={headingId}
          className="bg-muted text-foreground border-border flex flex-wrap items-center gap-x-4 gap-y-1 border-b py-2 ps-4 pe-2 text-sm"
        >
          <p className="font-medium" id={headingId}>
            {m.update_banner_title({ version: latest })}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <NewTabLink
              href={releaseNotesUrl(latest)}
              label={m.account_menu_update_release_notes()}
            />
            <NewTabLink
              href={updateGuideUrl(latest)}
              label={m.account_menu_update_guide()}
            />
          </div>
          <Button
            aria-label={m.update_banner_dismiss({ version: latest })}
            className="focus-visible:ring-foreground ms-auto focus-visible:ring-2"
            onClick={() => {
              focusPastTheBanner(reveal.current);
              dismissUpdate(latest);
            }}
            size="icon-compact"
            type="button"
            variant="tertiary"
          >
            <RiCloseLine aria-hidden="true" />
          </Button>
        </section>
      </div>
    </div>
  );
};

export const UpdateBanner = ({ latest }: { latest: string | null }) => {
  const dismissed = useDismissedUpdate();

  return isBannerShown(latest, dismissed) ? <Banner latest={latest} /> : null;
};
