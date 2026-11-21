import {
  DropdownContent,
  DropdownGroup,
  DropdownGroupLabel,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownSub,
  DropdownSubContent,
  DropdownSubTrigger,
  DropdownTrigger,
} from "@freenary/ui/components/dropdown";
import { MenuItem } from "@freenary/ui/components/menu-item";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@freenary/ui/components/sidebar";
import { RiExpandUpDownLine, RiExternalLinkLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Appearance,
  BookOpen,
  FileText,
  Languages,
  LogOut,
  Signpost,
} from "kubai-icons-react";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";
import { docsUrl, releaseNotesUrl, updateGuideUrl } from "@/shared/config";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { kubaiIcon } from "@/shared/lib/kubai-icon";
import { remixIcon } from "@/shared/lib/remix-icon";
import {
  LocaleMenuItems,
  localeCheckedIndex,
} from "@/shared/ui/locale-menu-items";
import {
  ThemeMenuItems,
  useThemeCheckedIndex,
} from "@/shared/ui/theme-menu-items";

import { useAvailableUpdate } from "./use-available-update";
import { UserIdentity } from "./user-identity";

const UPDATE_NOTES_ROW = 0;
const UPDATE_GUIDE_ROW = 1;
const LOCALE_ROW = 2;
const THEME_ROW = 3;
const DOCS_ROW = 4;
const SIGN_OUT_ROW = 5;

const openInNewTab = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const SUBMENU_CLASS = "w-48 min-w-0";

export const SidebarUserMenu = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isMobile } = useSidebar();
  const { data: session, isPending, refetch } = authClient.useSession();
  const themeCheckedIndex = useThemeCheckedIndex();
  const update = useAvailableUpdate();

  const refetchSessionThenLeaveAndDropCache = async () => {
    await refetch();
    await navigate({ to: "/login" });
    queryClient.clear();
  };

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: { onSuccess: refetchSessionThenLeaveAndDropCache },
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem aria-busy={isPending || undefined}>
        {isPending && (
          <output className="sr-only">{m.account_menu_loading()}</output>
        )}
        <DropdownMenu>
          <DropdownTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <UserIdentity
              email={session?.user.email}
              isPending={isPending}
              name={session?.user.name}
            />
            <RiExpandUpDownLine className="ml-auto size-3.5 shrink-0" />
          </DropdownTrigger>
          <DropdownContent
            align="end"
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownLabel>
              <div className="flex items-center gap-2 text-left text-sm">
                <UserIdentity
                  email={session?.user.email}
                  name={session?.user.name}
                />
              </div>
            </DropdownLabel>
            <DropdownSeparator />
            {update && (
              <>
                <DropdownGroup>
                  <DropdownGroupLabel>
                    {m.account_menu_update_available({ version: update })}
                  </DropdownGroupLabel>
                  <MenuItem
                    icon={kubaiIcon(FileText, CHART_COLOR_VARS.blue)}
                    index={UPDATE_NOTES_ROW}
                    aria-label={`${m.account_menu_update_release_notes()} ${m.update_banner_new_tab()}`}
                    label={m.account_menu_update_release_notes()}
                    trailingIcon={remixIcon(RiExternalLinkLine)}
                    onSelect={() => {
                      openInNewTab(releaseNotesUrl(update));
                    }}
                  />
                  <MenuItem
                    icon={kubaiIcon(Signpost, CHART_COLOR_VARS.orange)}
                    index={UPDATE_GUIDE_ROW}
                    aria-label={`${m.account_menu_update_guide()} ${m.update_banner_new_tab()}`}
                    label={m.account_menu_update_guide()}
                    trailingIcon={remixIcon(RiExternalLinkLine)}
                    onSelect={() => {
                      openInNewTab(updateGuideUrl());
                    }}
                  />
                </DropdownGroup>
                <DropdownSeparator />
              </>
            )}
            <DropdownSub>
              <DropdownSubTrigger
                icon={kubaiIcon(Languages, CHART_COLOR_VARS.blue)}
                index={LOCALE_ROW}
                label={m.locale_switcher_label()}
              />
              <DropdownSubContent
                checkedIndex={localeCheckedIndex()}
                className={SUBMENU_CLASS}
              >
                <DropdownLabel>{m.locale_switcher_label()}</DropdownLabel>
                <LocaleMenuItems />
              </DropdownSubContent>
            </DropdownSub>
            <DropdownSub>
              <DropdownSubTrigger
                icon={kubaiIcon(Appearance, CHART_COLOR_VARS.purple)}
                index={THEME_ROW}
                label={m.theme_switcher_label()}
              />
              <DropdownSubContent
                checkedIndex={themeCheckedIndex}
                className={SUBMENU_CLASS}
              >
                <DropdownLabel>{m.theme_switcher_label()}</DropdownLabel>
                <ThemeMenuItems />
              </DropdownSubContent>
            </DropdownSub>
            <DropdownSeparator />
            <MenuItem
              icon={kubaiIcon(BookOpen, CHART_COLOR_VARS.green)}
              index={DOCS_ROW}
              label={m.account_documentation()}
              onSelect={() => {
                openInNewTab(docsUrl());
              }}
            />
            <MenuItem
              icon={kubaiIcon(LogOut, CHART_COLOR_VARS.red)}
              index={SIGN_OUT_ROW}
              label={m.account_sign_out()}
              onSelect={handleSignOut}
            />
          </DropdownContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
