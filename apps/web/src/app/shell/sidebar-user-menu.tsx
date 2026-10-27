import {
  DropdownContent,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownSubmenu,
  DropdownTrigger,
} from "@freenary/ui/components/dropdown";
import { MenuItem } from "@freenary/ui/components/menu-item";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@freenary/ui/components/sidebar";
import {
  RiBookOpenLine,
  RiContrastLine,
  RiExpandUpDownLine,
  RiFileList3Line,
  RiGuideLine,
  RiLogoutBoxLine,
  RiTranslate2,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";
import { docsUrl, releaseNotesUrl, updateGuideUrl } from "@/shared/config";
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
              hasUpdate={update !== null}
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
                <DropdownLabel>
                  {m.account_menu_update_available({ version: update })}
                </DropdownLabel>
                <MenuItem
                  icon={remixIcon(RiFileList3Line)}
                  index={UPDATE_NOTES_ROW}
                  label={m.account_menu_update_release_notes()}
                  onSelect={() => {
                    openInNewTab(releaseNotesUrl(update));
                  }}
                />
                <MenuItem
                  icon={remixIcon(RiGuideLine)}
                  index={UPDATE_GUIDE_ROW}
                  label={m.account_menu_update_guide()}
                  onSelect={() => {
                    openInNewTab(updateGuideUrl(update));
                  }}
                />
                <DropdownSeparator />
              </>
            )}
            <DropdownSubmenu>
              <MenuItem
                icon={remixIcon(RiTranslate2)}
                index={LOCALE_ROW}
                label={m.locale_switcher_label()}
                submenu
              />
              <DropdownContent
                align="start"
                checkedIndex={localeCheckedIndex()}
                className={SUBMENU_CLASS}
                side="right"
              >
                <DropdownLabel>{m.locale_switcher_label()}</DropdownLabel>
                <LocaleMenuItems />
              </DropdownContent>
            </DropdownSubmenu>
            <DropdownSubmenu>
              <MenuItem
                icon={remixIcon(RiContrastLine)}
                index={THEME_ROW}
                label={m.theme_switcher_label()}
                submenu
              />
              <DropdownContent
                align="start"
                checkedIndex={themeCheckedIndex}
                className={SUBMENU_CLASS}
                side="right"
              >
                <DropdownLabel>{m.theme_switcher_label()}</DropdownLabel>
                <ThemeMenuItems />
              </DropdownContent>
            </DropdownSubmenu>
            <DropdownSeparator />
            <MenuItem
              icon={remixIcon(RiBookOpenLine)}
              index={DOCS_ROW}
              label={m.account_documentation()}
              onSelect={() => {
                openInNewTab(docsUrl());
              }}
            />
            <MenuItem
              icon={remixIcon(RiLogoutBoxLine)}
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
