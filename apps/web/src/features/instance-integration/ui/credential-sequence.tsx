import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { spring } from "@freenary/ui/lib/springs";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { FormEvent } from "react";

import { m } from "@/paraglide/messages.js";

import type { CredentialStep } from "../model/credential-steps";
import {
  filledValuesOf,
  stepAfter,
  stepBefore,
  stepProblem,
} from "../model/credential-steps";
import type { FieldProblem } from "../model/field-rules";
import {
  fieldProblemMessage,
  redirectHelp,
  variantLabel,
} from "../model/labels";
import type { SaveOutcome } from "../model/outcome";
import type { IntegrationWording } from "../model/wording";
import { SAVE_LABELS } from "../model/wording";
import { OutcomeNotice } from "./outcome-notice";
import { PowensSandboxNote } from "./powens-sandbox-note";
import type { SetupVariantDescriptor } from "./provider-step";
import { RedirectUrlBox } from "./redirect-url-box";
import { SetupField } from "./setup-field";

const PROBE_FAILED = "probe-failed";
const POWENS = "powens";
const FOCUSABLE_FIELD = "input, textarea";
const STEP_TITLE = "h1";
const SUB_STEP_SHIFT_PX = 8;
const NO_SUB_STEP_SHIFT_PX = 0;

interface SubStepMotion {
  direction: 1 | -1;
  shift: number;
}

const subStepVariants = {
  center: { opacity: 1, transition: spring.moderate, x: 0 },
  enter: ({ direction, shift }: SubStepMotion) => ({
    opacity: 0,
    x: direction * shift,
  }),
  exit: ({ direction, shift }: SubStepMotion) => ({
    opacity: 0,
    transition: spring.moderate.exit,
    x: -direction * shift,
  }),
};

const focusStep = (body: HTMLDivElement | null) => {
  const target =
    body?.querySelector<HTMLElement>(FOCUSABLE_FIELD) ??
    body?.closest("form")?.querySelector<HTMLElement>(STEP_TITLE);

  target?.focus();
};

interface CredentialSequenceProps {
  isBusy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSave: (values: Record<string, string>, checkFirst: boolean) => void;
  outcome: SaveOutcome | undefined;
  steps: readonly CredentialStep[];
  variant: SetupVariantDescriptor;
  wording: IntegrationWording;
}

export const CredentialSequence = ({
  isBusy,
  onBack,
  onEdit,
  onSave,
  outcome,
  steps,
  variant,
  wording,
}: CredentialSequenceProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const prefersReducedMotion = useReducedMotion();
  const subStepMotion: SubStepMotion = {
    direction,
    shift: prefersReducedMotion ? NO_SUB_STEP_SHIFT_PX : SUB_STEP_SHIFT_PX,
  };

  const moveTo = (position: number) => {
    setDirection(position < index ? -1 : 1);
    setIndex(position);
  };

  const [values, setValues] = useState(() => filledValuesOf(variant.fields));
  const [problems, setProblems] = useState<Record<string, FieldProblem>>({});

  const provider = variantLabel(variant.id);
  const step = steps[index] ?? steps[0];
  const isLast = index === steps.length - 1;
  const checkFailed = outcome?.outcome === PROBE_FAILED;

  const problemAt = (position: number): FieldProblem | null => {
    const at = steps[position];
    const field =
      at?.kind === "field"
        ? variant.fields.find((entry) => entry.key === at.key)
        : undefined;

    return field === undefined
      ? null
      : stepProblem(field, values[field.key] ?? "");
  };

  const flag = (position: number, problem: FieldProblem) => {
    const at = steps[position];

    if (at?.kind === "field") {
      setProblems((held) => ({ ...held, [at.key]: problem }));
    }

    moveTo(position);
  };

  const save = (checkFirst: boolean) => {
    const failing = steps.findIndex((_, position) => problemAt(position));
    const problem = failing === -1 ? null : problemAt(failing);

    if (problem === null) {
      onSave(values, checkFirst);
    } else {
      flag(failing, problem);
    }
  };

  const goForward = (): boolean => {
    const problem = problemAt(index);

    if (problem !== null) {
      flag(index, problem);

      return false;
    }

    const move = stepAfter(index, steps.length);

    if (move.kind === "step") {
      moveTo(move.index);
    } else {
      save(true);
    }

    return true;
  };

  const goBack = () => {
    const move = stepBefore(index);

    if (move.kind === "step") {
      moveTo(move.index);
    } else {
      onBack();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!goForward()) {
      event.currentTarget.querySelector<HTMLElement>(FOCUSABLE_FIELD)?.focus();
    }
  };

  const renderStep = () => {
    if (step === undefined) {
      return null;
    }

    if (step.kind === "redirect") {
      return (
        <RedirectUrlBox help={redirectHelp(variant.id)} provider={variant.id} />
      );
    }

    const field = variant.fields.find((entry) => entry.key === step.key);

    if (field === undefined) {
      return null;
    }

    const problem = problems[field.key];

    return (
      <SetupField
        descriptor={field}
        error={problem === undefined ? null : fieldProblemMessage(problem)}
        onChange={(key, next) => {
          onEdit();
          setValues((held) => ({ ...held, [key]: next }));
          setProblems((held) =>
            Object.fromEntries(
              Object.entries(held).filter(([name]) => name !== key)
            )
          );
        }}
        value={values[field.key]}
      />
    );
  };

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {m.setup_credentials_step({
            current: String(index + 1),
            total: String(steps.length),
          })}
        </p>
        <h1
          className="text-2xl font-bold tracking-tight outline-none"
          tabIndex={-1}
        >
          {m.setup_credentials_title({ provider })}
        </h1>
      </div>

      <div className="relative">
        <AnimatePresence
          custom={subStepMotion}
          initial={false}
          mode="popLayout"
        >
          <motion.div
            key={index}
            animate="center"
            className="flex flex-col gap-4"
            custom={subStepMotion}
            exit="exit"
            initial="enter"
            ref={focusStep}
            variants={subStepVariants}
          >
            {renderStep()}
            {isLast && variant.id === POWENS ? <PowensSandboxNote /> : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {isLast ? <OutcomeNotice outcome={outcome} provider={provider} /> : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={isLast && isBusy}
          leadingIcon={ArrowLeftIcon}
          onClick={goBack}
          type="button"
          variant="ghost"
        >
          {m.setup_back()}
        </Button>
        <div className="flex items-center gap-2">
          {isLast && checkFailed ? (
            <Button
              disabled={isBusy}
              onClick={() => save(false)}
              type="button"
              variant="secondary"
            >
              {m.setup_save_anyway()}
            </Button>
          ) : null}
          <Button loading={isLast && isBusy} type="submit">
            {isLast ? SAVE_LABELS[wording]() : m.setup_next()}
          </Button>
        </div>
      </div>
    </form>
  );
};
