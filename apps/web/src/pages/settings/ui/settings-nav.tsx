import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@freenary/ui/components/sidebar";
import { Link } from "@tanstack/react-router";

import { m } from "@/paraglide/messages.js";
import type { SettingsSection } from "@/shared/config";
import { remixIcon } from "@/shared/lib/remix-icon";

import { settingsNavItemsFor } from "../model/settings-nav-items";
import type { OperatorStanding } from "../model/settings-nav-items";

interface SettingsNavProps {
  section: SettingsSection | null;
  standing: OperatorStanding;
}

const RAIL_HOLDS_ITS_PLACE_WHILE_THE_PANE_SCROLLS =
  "lg:sticky lg:top-4 lg:w-48 lg:shrink-0 lg:self-start";

export const SettingsNav = ({ section, standing }: SettingsNavProps) => (
  <nav
    aria-label={m.settings_nav_label()}
    className={RAIL_HOLDS_ITS_PLACE_WHILE_THE_PANE_SCROLLS}
  >
    <SidebarMenu>
      {settingsNavItemsFor(standing).map((item) => (
        <SidebarMenuItem key={item.section}>
          <SidebarMenuButton
            icon={remixIcon(item.icon)}
            isActive={item.section === section}
            render={<Link search={{ section: item.section }} to="/settings" />}
          >
            {item.label()}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </nav>
);
