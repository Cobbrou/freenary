import { Button } from "@freenary/ui/components/button";
import {
  CommandMenu,
  CommandMenuDialog,
  CommandMenuEmpty,
  CommandMenuInput,
  CommandMenuList,
} from "@freenary/ui/components/command-menu";
import type { CommandMenuItemData } from "@freenary/ui/components/command-menu";
import { Spinner } from "@freenary/ui/components/spinner";
import { RiCpuLine, RiExpandUpDownLine, RiServerLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import { browserModelCatalog } from "../model/browser/engine";
import { browserModelLabel } from "../model/browser/models";
import { SERVER_MODEL } from "../model/model-choice";

interface AssistantModelSelectorProps {
  disabled: boolean;
  loadingProgress?: number;
  onSelect: (modelId: string) => void;
  selected: string | null;
  serverModel: string | null;
  webGpu: boolean | null;
}

const MB_PER_GB = 1024;

const gigabytes = (mb: number): string =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "gigabyte",
  }).format(mb / MB_PER_GB);

const percent = (fraction: number): string =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(fraction);

export const AssistantModelSelector = ({
  disabled,
  loadingProgress,
  onSelect,
  selected,
  serverModel,
  webGpu,
}: AssistantModelSelectorProps) => {
  const [open, setOpen] = useState(false);
  const webGpuAvailable = webGpu === true;
  const catalog = useQuery({
    enabled: open && webGpuAvailable,
    queryFn: browserModelCatalog,
    queryKey: ["assistant", "browser-models"],
    staleTime: Number.POSITIVE_INFINITY,
  });

  const pick = useCallback(
    (modelId: string) => {
      onSelect(modelId);
      setOpen(false);
    },
    [onSelect]
  );

  const items = useMemo<CommandMenuItemData[]>(() => {
    const rows: CommandMenuItemData[] = [];

    if (serverModel !== null) {
      rows.push({
        group: m.assistant_model_server_group(),
        icon: remixIcon(RiServerLine),
        label: serverModel,
        onSelect: () => pick(SERVER_MODEL),
        value: SERVER_MODEL,
      });
    }

    if (webGpu === true && catalog.data) {
      for (const model of catalog.data) {
        rows.push({
          description: gigabytes(model.vramMb),
          group: m.assistant_model_device_group(),
          icon: remixIcon(RiCpuLine),
          keywords: [model.id],
          label: model.label,
          onSelect: () => pick(model.id),
          value: model.id,
        });
      }
    }

    return rows;
  }, [serverModel, webGpu, catalog.data, pick]);

  const serverSelected = selected === SERVER_MODEL;
  let label: string = m.assistant_model_choose();

  if (serverSelected && serverModel !== null) {
    label = serverModel;
  } else if (selected !== null && !serverSelected) {
    label = browserModelLabel(selected);
  }

  const hasOptions = serverModel !== null || webGpuAvailable;
  const stillDownloading = loadingProgress !== undefined;

  if (stillDownloading) {
    return (
      <Button disabled leadingIcon={Spinner} size="compact" variant="ghost">
        <span className="inline-flex max-w-56 items-center gap-1.5">
          <span className="min-w-0 truncate">
            {m.assistant_browser_loading({ model: label })}
          </span>
          <span className="shrink-0 tabular-nums">
            {percent(loadingProgress)}
          </span>
        </span>
      </Button>
    );
  }

  const modelIcon = remixIcon(
    selected === SERVER_MODEL ? RiServerLine : RiCpuLine
  );

  return (
    <>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        leadingIcon={modelIcon}
        onClick={() => setOpen(true)}
        size="compact"
        trailingIcon={remixIcon(RiExpandUpDownLine)}
        variant="ghost"
      >
        <span className="block max-w-40 truncate">{label}</span>
      </Button>
      <CommandMenuDialog
        className="sm:max-w-lg"
        onOpenChange={setOpen}
        open={open}
        shortcut={null}
        title={m.assistant_model_label()}
      >
        <CommandMenu items={items}>
          <CommandMenuInput placeholder={m.assistant_model_search()} />
          <CommandMenuList>
            {hasOptions && (
              <CommandMenuEmpty>{m.assistant_model_none()}</CommandMenuEmpty>
            )}
            {webGpuAvailable && catalog.isPending && (
              <div className="text-muted-foreground flex items-center gap-2 px-2.5 py-1.5 text-xs">
                <Spinner className="size-3.5" />
                {m.assistant_browser_catalog_loading()}
              </div>
            )}
            {webGpuAvailable && catalog.isError && (
              <div
                className="text-destructive flex items-center gap-2 px-2.5 py-1.5 text-xs"
                role="alert"
              >
                <span>{m.assistant_model_catalog_failed()}</span>
                <Button
                  className="underline underline-offset-4"
                  onClick={() => catalog.refetch()}
                  size="compact"
                  variant="ghost"
                >
                  {m.assistant_retry()}
                </Button>
              </div>
            )}
          </CommandMenuList>
        </CommandMenu>
      </CommandMenuDialog>
    </>
  );
};
