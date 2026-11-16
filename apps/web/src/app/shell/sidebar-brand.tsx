import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@freenary/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { m } from "@/paraglide/messages.js";

export const SidebarBrand = () => {
  const [greeted, setGreeted] = useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem
        onBlur={() => setGreeted(false)}
        onFocus={() => setGreeted(true)}
        onPointerEnter={() => setGreeted(true)}
        onPointerLeave={() => setGreeted(false)}
      >
        <SidebarMenuButton render={<Link to="/" />} size="lg">
          <BrandAvatar
            className="size-6!"
            state={greeted ? "saving" : "logo"}
          />
          <span className="font-heading text-sm font-semibold tracking-tight">
            {m.shell_brand_name()}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
