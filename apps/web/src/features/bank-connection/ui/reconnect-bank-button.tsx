import { Button } from "@freenary/ui/components/button";

import { m } from "@/paraglide/messages.js";

interface ReconnectBankButtonProps {
  institutionName: string;
  isReconnecting: boolean;
  onReconnect: () => void;
}

export const ReconnectBankButton = ({
  institutionName,
  isReconnecting,
  onReconnect,
}: ReconnectBankButtonProps) => (
  <Button
    aria-label={m.bank_reconnect_aria_label({ institution: institutionName })}
    loading={isReconnecting}
    onClick={onReconnect}
    type="button"
    variant="secondary"
  >
    {m.bank_reconnect()}
  </Button>
);
