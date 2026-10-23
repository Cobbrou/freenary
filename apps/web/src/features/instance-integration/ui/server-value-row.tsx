import { m } from "@/paraglide/messages.js";

import { fieldLabel } from "../model/labels";
import type { SetupFieldDescriptor } from "./setup-field";
import { isSecretKind } from "./setup-field";

interface ServerValueRowProps {
  descriptor: SetupFieldDescriptor;
  showsSource: boolean;
}

export const ServerValueRow = ({
  descriptor,
  showsSource,
}: ServerValueRowProps) => {
  const shown = isSecretKind(descriptor.kind) ? null : descriptor.value;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-sm">{fieldLabel(descriptor.key)}</dt>
      <dd className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
        {shown === null ? null : (
          <code className="font-mono break-all">{shown}</code>
        )}
        {showsSource ? (
          <span className="bg-accent text-foreground shrink-0 rounded-md px-1.5 py-0.5 text-xs">
            {m.setup_set_by_server()}
          </span>
        ) : null}
      </dd>
    </div>
  );
};
