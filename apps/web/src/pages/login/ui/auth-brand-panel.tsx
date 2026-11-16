import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import { BrandPattern } from "@freenary/ui/components/brand-pattern";

import { m } from "@/paraglide/messages.js";

export const AuthBrandPanel = () => (
  <div className="bg-muted relative hidden overflow-hidden lg:flex lg:flex-col">
    <BrandPattern className="opacity-20 dark:opacity-25" />
    <div
      aria-hidden="true"
      className="from-muted absolute top-1/2 left-1/2 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-radial from-35% to-transparent"
    />
    <div
      aria-hidden="true"
      className="from-muted absolute inset-x-0 bottom-0 h-56 bg-linear-to-t to-transparent"
    />
    <div className="relative flex flex-1 items-center justify-center p-8">
      <BrandAvatar frozen size={176} state="logo" />
    </div>
    <div className="relative p-8">
      <h2 className="text-3xl font-bold tracking-tight">freenary</h2>
      <p className="text-muted-foreground mt-1 text-sm italic">
        {m.auth_tagline()}
      </p>
    </div>
  </div>
);
