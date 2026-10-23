import { Button } from "@freenary/ui/components/button";
import { Elevated } from "@freenary/ui/lib/elevated";
import { useIcon } from "@freenary/ui/lib/icon-context";
import type { ComponentType } from "react";
import { useState } from "react";

import { m } from "@/paraglide/messages.js";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

import type { FieldProblem } from "../model/field-rules";
import { fieldProblem } from "../model/field-rules";
import {
  fieldProblemMessage,
  variantGuideUrl,
  variantLabel,
} from "../model/labels";
import type { SaveOutcome } from "../model/outcome";
import { GuideLink } from "./guide-link";
import { OutcomeNotice } from "./outcome-notice";
import { PowensGuide, PowensSandboxNote } from "./powens-guide";
import type { SetupVariantDescriptor } from "./provider-step";
import { ServerValueRow } from "./server-value-row";
import type { SetupFieldDescriptor } from "./setup-field";
import { SetupField } from "./setup-field";

const ENVIRONMENT_SOURCE = "environment";
const SURFACE_RADIUS = "rounded-xl";
const SURFACE_STEP = 1;
const PROBE_FAILED = "probe-failed";

interface VariantGuide {
  readonly Note: ComponentType;
  readonly Steps: ComponentType;
}

const VARIANT_GUIDES: Readonly<Record<string, VariantGuide>> = {
  powens: { Note: PowensSandboxNote, Steps: PowensGuide },
};

interface ProviderCredentialsProps {
  isBusy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSave: (values: Record<string, string>, checkFirst: boolean) => void;
  outcome: SaveOutcome | undefined;
  variant: SetupVariantDescriptor;
}

const isFromServer = (field: SetupFieldDescriptor): boolean =>
  field.source === ENVIRONMENT_SOURCE;

const filledValuesOf = (
  fields: readonly SetupFieldDescriptor[]
): Record<string, string> =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const starting = field.value ?? field.suggestion;

      return starting === null || isFromServer(field)
        ? []
        : [[field.key, starting]];
    })
  );

const withoutKey = <Value,>(
  record: Record<string, Value>,
  key: string
): Record<string, Value> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

const problemsOf = (
  fields: readonly SetupFieldDescriptor[],
  values: Record<string, string>
): Record<string, FieldProblem> =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const problem = fieldProblem(field.key, values[field.key] ?? "");

      return problem === null ? [] : [[field.key, problem]];
    })
  );

export const ProviderCredentials = ({
  isBusy,
  onBack,
  onEdit,
  onSave,
  outcome,
  variant,
}: ProviderCredentialsProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");
  const [values, setValues] = useState(() => filledValuesOf(variant.fields));
  const [problems, setProblems] = useState<Record<string, FieldProblem>>({});

  const provider = variantLabel(variant.id);
  const guideUrl = variantGuideUrl(variant.id);
  const guide: VariantGuide | undefined = VARIANT_GUIDES[variant.id];

  const fromServer = variant.fields.filter(isFromServer);
  const editable = variant.fields.filter((field) => !isFromServer(field));
  const required = editable.filter((field) => field.required);
  const optional = editable.filter((field) => !field.required);
  const checkFailed = outcome?.outcome === PROBE_FAILED;

  const save = (checkFirst: boolean) => {
    const found = problemsOf(editable, values);

    setProblems(found);

    if (Object.keys(found).length === 0) {
      onSave(values, checkFirst);
    }
  };

  const renderField = (field: SetupFieldDescriptor) => {
    const problem = problems[field.key];

    return (
      <SetupField
        descriptor={field}
        error={problem === undefined ? null : fieldProblemMessage(problem)}
        key={field.key}
        onChange={(key, next) => {
          onEdit();
          setValues((held) => ({ ...held, [key]: next }));
          setProblems((held) => withoutKey(held, key));
        }}
        value={values[field.key]}
      />
    );
  };

  const guideLink =
    guideUrl === null ? null : (
      <GuideLink href={guideUrl}>
        {m.setup_variant_guide({ provider })}
      </GuideLink>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <WizardStepHeader
          description={m.setup_credentials_description({ provider })}
          title={m.setup_credentials_title({ provider })}
        />
        {guide === undefined ? guideLink : null}
      </div>

      {guide === undefined ? null : (
        <div className="flex flex-col gap-4">
          <guide.Steps />
          {guideLink}
        </div>
      )}

      {fromServer.length > 0 ? (
        <Elevated className={SURFACE_RADIUS} offset={SURFACE_STEP}>
          <dl className="divide-border flex flex-col divide-y px-4">
            {fromServer.map((field) => (
              <ServerValueRow descriptor={field} key={field.key} showsSource />
            ))}
          </dl>
        </Elevated>
      ) : null}

      {required.length > 0 ? (
        <div className="flex flex-col gap-4">{required.map(renderField)}</div>
      ) : null}

      {optional.length > 0 ? (
        <details className="group flex flex-col gap-4">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
            {m.setup_more_options()}
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            {optional.map(renderField)}
          </div>
        </details>
      ) : null}

      {guide === undefined ? null : <guide.Note />}

      <OutcomeNotice outcome={outcome} provider={provider} />

      <div className="flex items-center justify-between gap-3">
        <Button
          leadingIcon={ArrowLeftIcon}
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          {m.setup_back()}
        </Button>
        <div className="flex items-center gap-2">
          {checkFailed ? (
            <Button
              disabled={isBusy}
              onClick={() => save(false)}
              type="button"
              variant="secondary"
            >
              {m.setup_save_anyway()}
            </Button>
          ) : null}
          <Button loading={isBusy} onClick={() => save(true)} type="button">
            {m.setup_save_and_continue()}
          </Button>
        </div>
      </div>
    </div>
  );
};
