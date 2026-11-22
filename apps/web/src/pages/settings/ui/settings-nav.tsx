import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@freenary/ui/components/select";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@freenary/ui/components/sidebar";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId } from "react";

import { m } from "@/paraglide/messages.js";
import { isSettingsSection } from "@/shared/config";
import type { SettingsSection } from "@/shared/config";
import { kubaiIcon } from "@/shared/lib/kubai-icon";

import { settingsNavCategoriesFor } from "../model/settings-nav-items";
import type { OperatorStanding } from "../model/settings-nav-items";

interface SettingsNavProps {
  section: SettingsSection;
  standing: OperatorStanding;
}

type SettingsNavCategories = ReturnType<typeof settingsNavCategoriesFor>;

const RAIL_HOLDS_ITS_PLACE_WHILE_THE_PANE_SCROLLS =
  "lg:sticky lg:top-[calc(var(--update-banner-height,0px)+1rem)] lg:w-52 lg:shrink-0 lg:self-start";

const NARROW_ONLY = "lg:hidden";

const WIDE_ONLY = "hidden lg:flex";

const SettingsRail = ({
  categories,
  section,
}: {
  categories: SettingsNavCategories;
  section: SettingsSection;
}) => {
  const labelId = useId();

  return (
    <div className={`${WIDE_ONLY} flex-col gap-3`}>
      {categories.map((category) => (
        <SidebarGroup className="p-0" key={category.id}>
          <SidebarGroupLabel
            className="text-muted-foreground"
            id={`${labelId}-${category.id}`}
          >
            {category.label()}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-labelledby={`${labelId}-${category.id}`}>
              {category.items.map((item) => (
                <SidebarMenuItem key={item.section}>
                  <SidebarMenuButton
                    icon={kubaiIcon(item.icon, item.color)}
                    isActive={item.section === section}
                    render={
                      <Link search={{ section: item.section }} to="/settings" />
                    }
                  >
                    {item.label()}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  );
};

const SettingsPicker = ({
  categories,
  section,
}: {
  categories: SettingsNavCategories;
  section: SettingsSection;
}) => {
  const navigate = useNavigate();
  const labelId = useId();
  const current = categories
    .flatMap((category) => category.items)
    .find((item) => item.section === section);

  const indexOf = new Map(
    categories
      .flatMap((category) => category.items)
      .map((item, index) => [item.section, index])
  );

  return (
    <div className={NARROW_ONLY}>
      <Select
        onValueChange={(next: string) => {
          if (isSettingsSection(next)) {
            void navigate({ search: { section: next }, to: "/settings" });
          }
        }}
        value={section}
      >
        <SelectTrigger
          aria-label={m.settings_nav_label()}
          className="w-full"
          icon={current ? kubaiIcon(current.icon, current.color) : undefined}
          placeholder={m.settings_nav_label()}
        />
        <SelectContent>
          {categories.map((category) => (
            <SelectGroup
              aria-labelledby={`${labelId}-${category.id}`}
              key={category.id}
            >
              <SelectLabel id={`${labelId}-${category.id}`}>
                {category.label()}
              </SelectLabel>
              {category.items.map((item) => (
                <SelectItem
                  icon={kubaiIcon(item.icon, item.color)}
                  index={indexOf.get(item.section) ?? 0}
                  key={item.section}
                  value={item.section}
                >
                  {item.label()}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const SettingsNav = ({ section, standing }: SettingsNavProps) => {
  const categories = settingsNavCategoriesFor(standing);

  return (
    <nav
      aria-label={m.settings_nav_label()}
      className={RAIL_HOLDS_ITS_PLACE_WHILE_THE_PANE_SCROLLS}
    >
      <SettingsPicker categories={categories} section={section} />
      <SettingsRail categories={categories} section={section} />
    </nav>
  );
};
