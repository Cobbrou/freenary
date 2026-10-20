import { normaliseDescriptor } from "../normalise/normalise-descriptor";
import {
  BY_CREDITOR_IBAN,
  BY_LEADING_MARKER,
  BY_SEPA_CREDITOR_IDENTIFIER,
  intermediaryFor,
} from "./catalogue";
import type {
  DetectIntermediaryInput,
  IntermediaryConfidence,
  IntermediaryMatch,
} from "./types";

const SCHEME_PERMITTED_ACQUIRER_PREFIX_WIDTHS = [3, 7, 12] as const;
const ASTERISK_CODE_POINT = 42;

const hasCorroboratingAsterisk = (raw: string): boolean => {
  for (const prefixWidth of SCHEME_PERMITTED_ACQUIRER_PREFIX_WIDTHS) {
    if (raw.codePointAt(prefixWidth) === ASTERISK_CODE_POINT) {
      return true;
    }
  }

  return false;
};

export const detectIntermediary = (
  input: DetectIntermediaryInput
): IntermediaryMatch | null => {
  const {
    creditorIban,
    creditorIdentifications,
    normalisedDescriptor,
    rawDescriptor,
  } = input;

  if (normalisedDescriptor.length > 0) {
    const leadingTokenEnd = normalisedDescriptor.indexOf(" ");
    const leadingToken =
      leadingTokenEnd === -1
        ? normalisedDescriptor
        : normalisedDescriptor.slice(0, leadingTokenEnd);

    const marked = intermediaryFor(BY_LEADING_MARKER, leadingToken);

    if (marked) {
      const confidence: IntermediaryConfidence =
        marked.definition.hasSchemeDocumentedPrefix ||
        hasCorroboratingAsterisk(rawDescriptor)
          ? "high"
          : "medium";

      const trailingText =
        marked.definition.carriesSubmerchant && leadingTokenEnd !== -1
          ? normalisedDescriptor.slice(leadingTokenEnd + 1)
          : "";

      const submerchantText = trailingText.length > 0 ? trailingText : null;

      return {
        confidence,
        intermediaryId: marked.id,
        intermediaryName: marked.definition.name,
        matchedBy: "marker",
        normalisedSubmerchant: submerchantText
          ? normaliseDescriptor(submerchantText)
          : "",
        submerchantText,
      };
    }
  }

  const byIban = creditorIban
    ? intermediaryFor(BY_CREDITOR_IBAN, creditorIban)
    : undefined;

  if (byIban) {
    return {
      confidence: "high",
      intermediaryId: byIban.id,
      intermediaryName: byIban.definition.name,
      matchedBy: "iban",
      normalisedSubmerchant: "",
      submerchantText: null,
    };
  }

  for (const { identification } of creditorIdentifications ?? []) {
    const byCreditorIdentifier = intermediaryFor(
      BY_SEPA_CREDITOR_IDENTIFIER,
      identification
    );

    if (byCreditorIdentifier) {
      return {
        confidence: "high",
        intermediaryId: byCreditorIdentifier.id,
        intermediaryName: byCreditorIdentifier.definition.name,
        matchedBy: "creditor-identifier",
        normalisedSubmerchant: "",
        submerchantText: null,
      };
    }
  }

  return null;
};
