import { normaliseDescriptor } from "../normalise-descriptor";
import type {
  DescriptorParseInput,
  DescriptorParseResult,
  TransactionChannel,
} from "../types";
import type { DescriptorCaptureGroups } from "./capture-groups";
import { nonBlankCapture } from "./capture-groups";
import {
  allChannelVerbsLongestFirst,
  allTrailingNoiseInStripOrder,
} from "./countries";
import type { InstitutionDef, PatternRule } from "./definitions";
import { channelFromFamilyCode } from "./iso20022-channel";

interface LineMatch {
  payee: string;
  channel: TransactionChannel;
  cardLast4?: string;
  labelDate?: string;
}

interface VerbPrefixMatch {
  channel: TransactionChannel;
  text: string;
}

interface PartyNames {
  counterparty: string;
  accountHolder: string;
}

interface ParseState {
  payee: string | null;
  channel: TransactionChannel;
  cardLast4: string | undefined;
  labelDate: string | undefined;
  droppedLines: string[];
}

type PayeeCleaner = (text: string) => string;

export const GENERIC_PARSER_ID = "generic";

const UNKNOWN_CHANNEL: TransactionChannel = "unknown";
const DIRECT_DEBIT_CHANNEL: TransactionChannel = "direct-debit";
const COMBINING_MARKS = /[\u0300-\u036F]/gu;

const keepPayeeAsIs: PayeeCleaner = (text) => text;

const payeeFromGroups = (groups: DescriptorCaptureGroups): string | undefined =>
  nonBlankCapture(groups, "payee");

const hasPayee = (state: ParseState): boolean =>
  state.payee !== null && state.payee.length > 0;

const foldAccents = (text: string): string =>
  text.normalize("NFD").replaceAll(COMBINING_MARKS, "").toLowerCase();

const stripVerbPrefix = (line: string): VerbPrefixMatch => {
  for (const [verbPrefix, channel] of allChannelVerbsLongestFirst) {
    if (verbPrefix.test(line)) {
      return { channel, text: line.replace(verbPrefix, "").trim() };
    }
  }

  return { channel: UNKNOWN_CHANNEL, text: line };
};

const cleanTrailingNoise = (text: string): string => {
  let cleaned = text;

  for (const noise of allTrailingNoiseInStripOrder) {
    cleaned = cleaned.replace(noise, "");
  }

  return cleaned.trim();
};

const firstPatternMatch = (
  line: string,
  rules: readonly PatternRule[]
): LineMatch | null => {
  for (const rule of rules) {
    const groups: DescriptorCaptureGroups | undefined =
      rule.linePattern.exec(line)?.groups;

    if (!groups) {
      continue;
    }

    const payeeRaw = (rule.extractPayee ?? payeeFromGroups)(groups);

    if (!payeeRaw) {
      continue;
    }

    const payee = cleanTrailingNoise(payeeRaw);

    if (payee.length === 0) {
      continue;
    }

    const capturedDate = nonBlankCapture(groups, "date");

    return {
      cardLast4: nonBlankCapture(groups, "card"),
      channel: rule.channel,
      labelDate:
        capturedDate && rule.parseLabelDate
          ? rule.parseLabelDate(capturedDate)
          : undefined,
      payee,
    };
  }

  return null;
};

const matchesBicPrefix = (
  bic: string | null | undefined,
  prefixes: readonly string[]
): boolean => {
  if (!bic) {
    return false;
  }

  const upper = bic.toUpperCase();

  return prefixes.some((prefix) => upper.startsWith(prefix));
};

const matchesFoldedSubstring = (
  haystack: string | null | undefined,
  needles: readonly string[] | undefined
): boolean => {
  if (!(haystack && needles)) {
    return false;
  }

  const folded = foldAccents(haystack);

  return needles.some((needle) => folded.includes(foldAccents(needle)));
};

const isBlankOrDeclaredNoise = (
  line: string,
  institution: InstitutionDef | null
): boolean =>
  line.length === 0 ||
  (institution?.noiseLinePatterns?.some((noise) => noise.test(line)) ?? false);

const overridePayeeFromPattern = (
  state: ParseState,
  match: LineMatch,
  clean: PayeeCleaner
): void => {
  state.payee = clean(match.payee);

  if (state.channel === UNKNOWN_CHANNEL && match.channel !== UNKNOWN_CHANNEL) {
    state.channel = match.channel;
  }

  state.cardLast4 = match.cardLast4;
  state.labelDate = match.labelDate;
};

const applyVerbLine = (
  state: ParseState,
  line: string,
  verbChannel: TransactionChannel,
  cleaned: string
): void => {
  if (state.channel === UNKNOWN_CHANNEL) {
    state.channel = verbChannel;
  }

  if (cleaned.length > 0 && !hasPayee(state)) {
    state.payee = cleaned;
  } else {
    state.droppedLines.push(line);
  }
};

const keepFirstUnmatchedLine = (
  state: ParseState,
  line: string,
  clean: PayeeCleaner
): void => {
  if (hasPayee(state)) {
    state.droppedLines.push(line);

    return;
  }

  state.payee = clean(line);
};

const keepLongestCleanedLine = (
  state: ParseState,
  line: string,
  clean: PayeeCleaner
): void => {
  const cleaned = clean(cleanTrailingNoise(line));

  if (cleaned.length > (state.payee?.length ?? 0)) {
    state.payee = cleaned;
  }
};

const consumeLine = (
  state: ParseState,
  line: string,
  institution: InstitutionDef | null,
  clean: PayeeCleaner
): void => {
  if (institution) {
    const match = firstPatternMatch(line, institution.patternsInMatchOrder);

    if (match) {
      overridePayeeFromPattern(state, match, clean);

      return;
    }
  }

  const { channel: verbChannel, text: afterVerb } = stripVerbPrefix(line);

  if (verbChannel !== UNKNOWN_CHANNEL) {
    applyVerbLine(
      state,
      line,
      verbChannel,
      clean(cleanTrailingNoise(afterVerb))
    );

    return;
  }

  if (institution) {
    keepFirstUnmatchedLine(state, line, clean);

    return;
  }

  keepLongestCleanedLine(state, line, clean);
};

const partyNames = (input: DescriptorParseInput): PartyNames => {
  const isIncoming = input.amountMinor >= 0;

  return {
    accountHolder:
      (isIncoming ? input.creditorName : input.debtorName)?.trim() ?? "",
    counterparty:
      (isIncoming ? input.debtorName : input.creditorName)?.trim() ?? "",
  };
};

const applyCounterparty = (
  state: ParseState,
  input: DescriptorParseInput
): void => {
  const { accountHolder, counterparty } = partyNames(input);

  if (state.channel === DIRECT_DEBIT_CHANNEL && counterparty.length > 0) {
    state.payee = counterparty;
  }

  if (!hasPayee(state)) {
    if (counterparty.length > 0) {
      state.payee = counterparty;
    } else {
      state.payee = accountHolder.length > 0 ? accountHolder : null;
    }
  }
};

export const matchesInstitution = (
  input: DescriptorParseInput,
  def: InstitutionDef
): boolean =>
  matchesBicPrefix(input.institutionBic, def.bicPrefixes) ||
  matchesFoldedSubstring(input.institutionGroup, def.groupSubstrings) ||
  matchesFoldedSubstring(input.institutionName, def.nameSubstrings);

export const parseWithInstitution = (
  input: DescriptorParseInput,
  institution: InstitutionDef | null
): DescriptorParseResult => {
  const state: ParseState = {
    cardLast4: undefined,
    channel:
      channelFromFamilyCode(input.bankTransactionFamilyCode) ?? UNKNOWN_CHANNEL,
    droppedLines: [],
    labelDate: undefined,
    payee: null,
  };

  const clean = institution?.cleanPayee ?? keepPayeeAsIs;

  for (const raw of input.remittanceLines.toSorted()) {
    const line = raw.trim();

    if (isBlankOrDeclaredNoise(line, institution)) {
      state.droppedLines.push(line);

      continue;
    }

    consumeLine(state, line, institution, clean);
  }

  applyCounterparty(state, input);

  return {
    cardLast4: state.cardLast4,
    channel: state.channel,
    droppedLines: state.droppedLines,
    labelDate: state.labelDate,
    normalisedDescriptor: state.payee ? normaliseDescriptor(state.payee) : "",
    parserId: institution?.id ?? GENERIC_PARSER_ID,
    payeeText: state.payee,
  };
};
