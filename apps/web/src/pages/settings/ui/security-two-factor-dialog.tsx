import { Button } from "@freenary/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@freenary/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import { Elevated } from "@freenary/ui/lib/elevated";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { Data, Effect } from "effect";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { TOTP_CODE_LENGTH } from "@/shared/auth";

import { useTwoFactorEnrollment } from "../model/use-two-factor-enrollment";
import type {
  TwoFactorPurpose,
  TwoFactorStage,
} from "../model/use-two-factor-enrollment";

interface SecurityTwoFactorDialogProps {
  onEnabled: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  purpose: TwoFactorPurpose;
}

const QR_SIZE_PX = 168;

const TALLER_THAN_A_SHORT_VIEWPORT =
  "max-h-[calc(100dvh-4rem)] overflow-y-auto";

const STAGE_DESCRIPTIONS = {
  codes: m.settings_2fa_step_codes_description,
  confirm: m.settings_2fa_step_confirm_description,
  password: m.settings_2fa_step_password_description,
  scan: m.settings_2fa_step_scan_description,
} satisfies Record<TwoFactorStage, () => string>;

class ClipboardWriteRefused extends Data.TaggedError("ClipboardWriteRefused")<{
  readonly cause: unknown;
}> {}

const copyBackupCodes = (backupCodes: readonly string[]) =>
  Effect.tryPromise({
    catch: (cause) => new ClipboardWriteRefused({ cause }),
    try: () => navigator.clipboard.writeText(backupCodes.join("\n")),
  }).pipe(
    Effect.andThen(
      Effect.sync(() => {
        toast.success(m.settings_2fa_codes_copied());
      })
    ),
    Effect.catchTag("ClipboardWriteRefused", () =>
      Effect.sync(() => {
        toast.error(m.settings_2fa_codes_copy_error());
      })
    )
  );

export const SecurityTwoFactorDialog = ({
  onEnabled,
  onOpenChange,
  open,
  purpose,
}: SecurityTwoFactorDialogProps) => {
  const {
    backupCodes,
    codeError,
    codeForm,
    passwordError,
    passwordForm,
    reset,
    showConfirmStage,
    stage,
    totpUri,
  } = useTwoFactorEnrollment({ onEnabled, purpose });

  const { gap, px } = useSize();
  const CopyIcon = useIcon("copy");

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const isShowingCodesExactlyOnce = stage === "codes";

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next && isShowingCodesExactlyOnce) {
          return;
        }

        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent
        className={TALLER_THAN_A_SHORT_VIEWPORT}
        showCloseButton={!isShowingCodesExactlyOnce}
        size="sm"
      >
        <DialogHeader>
          <DialogTitle>
            {purpose === "regenerate"
              ? m.settings_2fa_dialog_title_regenerate()
              : m.settings_2fa_dialog_title_enable()}
          </DialogTitle>
          <DialogDescription>{STAGE_DESCRIPTIONS[stage]()}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {stage === "password" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                passwordForm.handleSubmit();
              }}
            >
              <FieldGroup>
                <passwordForm.Field name="password">
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.errors.length > 0 ||
                        passwordError !== null
                      }
                    >
                      <FieldLabel htmlFor="two-factor-password">
                        {m.settings_2fa_password_label()}
                      </FieldLabel>
                      <Input
                        aria-invalid={
                          field.state.meta.errors.length > 0 ||
                          passwordError !== null
                        }
                        autoComplete="current-password"
                        id="two-factor-password"
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={m.settings_2fa_password_placeholder()}
                        type="password"
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors}>
                        {passwordError}
                      </FieldError>
                    </Field>
                  )}
                </passwordForm.Field>

                <Field className="justify-end" orientation="horizontal">
                  <Button
                    onClick={() => onOpenChange(false)}
                    type="button"
                    variant="ghost"
                  >
                    {m.settings_cancel()}
                  </Button>
                  <passwordForm.Subscribe
                    selector={(state) => state.isSubmitting}
                  >
                    {(isSubmitting) => (
                      <Button loading={isSubmitting} type="submit">
                        {m.settings_2fa_continue()}
                      </Button>
                    )}
                  </passwordForm.Subscribe>
                </Field>
              </FieldGroup>
            </form>
          )}

          {stage === "scan" && (
            <>
              <figure className="flex flex-col items-center gap-2">
                <div className="rounded-md bg-white p-3">
                  <QRCodeSVG
                    marginSize={2}
                    size={QR_SIZE_PX}
                    title={m.settings_2fa_qr_label()}
                    value={totpUri}
                  />
                </div>
                <figcaption className="text-muted-foreground">
                  {m.settings_2fa_qr_caption()}
                </figcaption>
              </figure>

              <div className="flex flex-col gap-1.5">
                <p className="font-medium">{m.settings_2fa_manual_label()}</p>
                <code
                  className={cn(
                    "bg-muted rounded-md py-2 font-mono break-all select-all",
                    px
                  )}
                >
                  {totpUri}
                </code>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="ghost"
                >
                  {m.settings_cancel()}
                </Button>
                <Button onClick={showConfirmStage} type="button">
                  {m.settings_2fa_continue()}
                </Button>
              </div>
            </>
          )}

          {stage === "confirm" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                codeForm.handleSubmit();
              }}
            >
              <FieldGroup>
                <codeForm.Field name="code">
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.errors.length > 0 || codeError !== null
                      }
                    >
                      <FieldLabel htmlFor="two-factor-code">
                        {m.settings_2fa_code_label()}
                      </FieldLabel>
                      <Input
                        aria-invalid={
                          field.state.meta.errors.length > 0 ||
                          codeError !== null
                        }
                        autoComplete="one-time-code"
                        id="two-factor-code"
                        inputMode="numeric"
                        maxLength={TOTP_CODE_LENGTH}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={m.settings_2fa_code_placeholder()}
                        value={field.state.value}
                      />
                      <FieldError errors={field.state.meta.errors}>
                        {codeError}
                      </FieldError>
                    </Field>
                  )}
                </codeForm.Field>

                <Field className="justify-end" orientation="horizontal">
                  <Button
                    onClick={() => onOpenChange(false)}
                    type="button"
                    variant="ghost"
                  >
                    {m.settings_cancel()}
                  </Button>
                  <codeForm.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <Button loading={isSubmitting} type="submit">
                        {m.settings_2fa_confirm()}
                      </Button>
                    )}
                  </codeForm.Subscribe>
                </Field>
              </FieldGroup>
            </form>
          )}

          {stage === "codes" && (
            <>
              <p className="text-muted-foreground">
                {m.settings_2fa_codes_warning()}
              </p>
              {purpose === "regenerate" && (
                <p className="text-destructive">
                  {m.settings_2fa_codes_replaced()}
                </p>
              )}
              <Elevated className={cn("rounded-md py-2", px)} offset={1}>
                <ul
                  className={cn("grid grid-cols-2 font-mono select-all", gap)}
                >
                  {backupCodes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              </Elevated>
              <div className="flex justify-end gap-2">
                <Button
                  leadingIcon={CopyIcon}
                  onClick={() => {
                    void Effect.runPromise(copyBackupCodes(backupCodes));
                  }}
                  type="button"
                  variant="tertiary"
                >
                  {m.settings_2fa_codes_copy()}
                </Button>
                <Button onClick={() => onOpenChange(false)} type="button">
                  {m.settings_2fa_codes_acknowledge()}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
