import { nonBlankCapture } from "../capture-groups";
import type { InstitutionDef } from "../definitions";
import type { ChannelVerbPattern, CountryProfile } from "./types";

const CENTURY_PREFIX = "20";
const DATE_SEPARATOR_RE = /[/-]/u;
const DDMMYY_DIGITS = 6;
const DDMMYYYY_DIGITS = 8;
const TWO_DIGIT_YEAR_LENGTH = 2;
const FOUR_DIGIT_YEAR_LENGTH = 4;
const DAY_MONTH_YEAR_PART_COUNT = 3;

const parseDdmmyyOrDdmmyyyyIgnoringSlashes = (
  raw: string
): string | undefined => {
  const digits = raw.replaceAll("/", "");

  if (digits.length === DDMMYY_DIGITS) {
    return `${CENTURY_PREFIX}${digits.slice(4, 6)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  }

  if (digits.length === DDMMYYYY_DIGITS) {
    return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  }

  return undefined;
};

const parseDdmmyy = (raw: string): string | undefined => {
  if (raw.length === DDMMYY_DIGITS) {
    return `${CENTURY_PREFIX}${raw.slice(4, 6)}-${raw.slice(2, 4)}-${raw.slice(0, 2)}`;
  }

  return undefined;
};

const parseDdmmyyyySeparated = (raw: string): string | undefined => {
  const [day, month, year] = raw.split(DATE_SEPARATOR_RE);

  if (year?.length === FOUR_DIGIT_YEAR_LENGTH) {
    return `${year}-${month}-${day}`;
  }

  return undefined;
};

const parseDdmmyyDotted = (raw: string): string | undefined => {
  const parts = raw.split(".");

  if (
    parts.length === DAY_MONTH_YEAR_PART_COUNT &&
    parts[2]?.length === TWO_DIGIT_YEAR_LENGTH
  ) {
    return `${CENTURY_PREFIX}${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return undefined;
};

const parseDdmmyySlashed = (raw: string): string | undefined => {
  const parts = raw.split("/");

  if (
    parts.length === DAY_MONTH_YEAR_PART_COUNT &&
    parts[2]?.length === TWO_DIGIT_YEAR_LENGTH
  ) {
    return `${CENTURY_PREFIX}${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return undefined;
};

const BOURSORAMA_CARD_PAYMENT_RE =
  /^CARTE\s+(?<date>\d{2}\/??\d{2}\/??\d{2,4})\s+(?<payee>.+?)(?:\s+\d+)?(?:\s+CB\*(?<card>\d{4}))?\s*$/iu;

const BOURSORAMA_ATM_WITHDRAWAL_RE =
  /^RETRAIT\s+DAB\s+(?<date>\d{2}\/??\d{2}\/??\d{2,4})\s+(?<payee>.+?)\s+CB\*(?<card>\d{4,})\s*$/iu;

const BOURSORAMA_CARD_REFUND_RE =
  /^AVOIR\s+(?<date>\d{2}\/??\d{2}\/??\d{2,4})\s+(?<payee>.+?)\s+CB\*(?<card>\d{4,})\s*$/iu;

const BOURSORAMA_SEPA_DIRECT_DEBIT_RE = /^PRLV\s+SEPA\s+(?<payee>.+)/iu;
const BOURSORAMA_TRANSFER_RE = /^VIR(?:\s+(?:SEPA|INST))?\s+(?<payee>.+)/iu;
const BOURSORAMA_LOAN_INSTALMENT_RE = /^ECH\s+PRET\s*:\s*(?<payee>.+)/iu;
const BOURSORAMA_REFERENCE_LINE_RE = /^R[ée]f\s*:\s/iu;
const BOURSORAMA_TRAILING_LOCATION_RE = /\\.+$/u;

const BNP_PARIBAS_CARD_PAYMENT_RE =
  /^FACTURE\s+CARTE\s+DU\s+(?<date>\d{6})\s+(?<payee>.+?)(?:\s+CARTE\s+(?<card>\d{4}))?\s*$/iu;

const BNP_PARIBAS_SEPA_DIRECT_DEBIT_RE =
  /^PRLV(?:\s+EUROPEEN)?\s+SEPA\s+(?<payee>.+?)(?:\s+MDT\/\S+)?(?:\s+ECH\/\S+)?(?:\s+ID\s+\S+)?\s*$/iu;

const BNP_PARIBAS_TRANSFER_RE =
  /^VIR(?:EMENT)?\s+(?:SEPA\s+|INST\s+)?(?<payee>.+)/iu;

const BNP_PARIBAS_ATM_WITHDRAWAL_RE = /^RETRAIT\s+DAB\s+(?<payee>.+)/iu;
const BNP_PARIBAS_CHEQUE_RE = /^CHQ?\s+(?<payee>.+)/iu;
const BNP_PARIBAS_FEE_RE = /^(?:FRAIS|COTISATION|COMMISSION)\s+(?<payee>.+)/iu;

const CREDIT_AGRICOLE_CARD_PAYMENT_RE =
  /^PAIEMENT\s+PAR\s+CARTE\s+(?<payee>.+?)\s+(?<date>\d{2}\/\d{2})\s*$/iu;

const CREDIT_AGRICOLE_DIRECT_DEBIT_DATED_RE =
  /^PRELEVEMENT\s+(?<payee>.+?)\s+(?<date>\d{2}\/\d{2}\/\d{4})\s*$/iu;

const CREDIT_AGRICOLE_DIRECT_DEBIT_DAY_MONTH_RE =
  /^PRELEVEMENT\s+(?<payee>.+?)\s+(?<date>\d{2}-\d{2})\s*$/iu;

const CREDIT_AGRICOLE_DIRECT_DEBIT_RE = /^PRELEVEMENT\s+(?<payee>.+)/iu;

const CREDIT_AGRICOLE_TRANSFER_RE =
  /^VIR(?:EMENT)?\s+(?:SEPA\s+)?(?<payee>.+)/iu;

const CREDIT_AGRICOLE_ATM_WITHDRAWAL_RE = /^RETRAIT\s+DAB\s+(?<payee>.+)/iu;
const CREDIT_AGRICOLE_CHEQUE_RE = /^(?:CHEQUE|CHQ)\s+(?<payee>.+)/iu;

const CREDIT_AGRICOLE_FEE_RE =
  /^(?:FRAIS|COTISATION|COMMISSION)\s+(?<payee>.+)/iu;

const SOCIETE_GENERALE_CARD_PAYMENT_RE =
  /^CARTE\s+(?<card>\w+)\s+(?<date>\d{2}\/\d{2})\s+(?<payee>.+)\s*$/iu;

const SOCIETE_GENERALE_DATE_PREFIXED_LINE_RE =
  /^(?<date>\d{4})\/(?<payee>.+)\s*$/u;

const SOCIETE_GENERALE_TRANSFER_WITH_MOTIF_RE =
  /^VIR\s+POUR\s*:\s*(?<payee>.+?)\s+REF\s*:\s*\S+\s+MOTIF\s*:\s*(?<motif>.+)\s*$/iu;

const SOCIETE_GENERALE_TRANSFER_RE =
  /^VIR(?:EMENT)?\s+(?:SEPA\s+)?(?<payee>.+)/iu;

const SOCIETE_GENERALE_DIRECT_DEBIT_RE = /^PRLV\s+(?:SEPA\s+)?(?<payee>.+)/iu;
const SOCIETE_GENERALE_ATM_WITHDRAWAL_RE = /^RETRAIT\s+DAB\s+(?<payee>.+)/iu;

const SOCIETE_GENERALE_FEE_RE =
  /^(?:FRAIS|COTISATION|COMMISSION)\s+(?<payee>.+)/iu;

const CREDIT_MUTUEL_CARD_PAYMENT_RE =
  /^PAIEMENT\s+(?:PSC|CB|MOB)\s+(?<date>\d{4})\s+(?<payee>.+?)\s+(?:CARTE\s*|PAYWEB)(?<card>\d+)\s*$/iu;

const CREDIT_MUTUEL_CARD_PAYMENT_WITHOUT_CARD_RE =
  /^PAIEMENT\s+(?:PSC|CB|MOB)\s+(?<date>\d{4})\s+(?<payee>.+)\s*$/iu;

const CREDIT_MUTUEL_DIRECT_DEBIT_RE = /^PRLV\s+(?:SEPA\s+)?(?<payee>.+)/iu;
const CREDIT_MUTUEL_TRANSFER_RE = /^VIR(?:EMENT)?\s+(?:SEPA\s+)?(?<payee>.+)/iu;
const CREDIT_MUTUEL_ATM_WITHDRAWAL_RE = /^RETRAIT\s+DAB\s+(?<payee>.+)/iu;
const CREDIT_MUTUEL_CHEQUE_RE = /^(?:CHEQUE|CHQ)\s+(?<payee>.+)/iu;

const CREDIT_MUTUEL_FEE_RE =
  /^(?:FRAIS|COTISATION|COMMISSION)\s+(?<payee>.+)/iu;

const LCL_CARD_PAYMENT_RE =
  /^CB\s+(?<payee>.+?)\s+(?<date>\d{2}\/\d{2}\/\d{2})\s*$/iu;

const LCL_DIRECT_DEBIT_RE = /^PRLV\s+(?:SEPA\s+)?(?<payee>.+)/iu;
const LCL_TRANSFER_RE = /^VIR(?:EMENT)?\s+(?:SEPA\s+)?(?<payee>.+)/iu;
const LCL_ATM_WITHDRAWAL_RE = /^RETRAIT\s+DAB\s+(?<payee>.+)/iu;
const LCL_CHEQUE_RE = /^(?:CHEQUE|CHQ)\s+(?<payee>.+)/iu;
const LCL_FEE_RE = /^(?:FRAIS|COTISATION|COMMISSION)\s+(?<payee>.+)/iu;

const LA_BANQUE_POSTALE_CARD_PAYMENT_RE =
  /^ACHAT\s+CB\s+(?<payee>.+?)\s+(?<date>\d{2}\.\d{2}\.\d{2})\s*$/iu;

const LA_BANQUE_POSTALE_DIRECT_DEBIT_RE = /^PRLV\s+(?:SEPA\s+)?(?<payee>.+)/iu;

const LA_BANQUE_POSTALE_TRANSFER_RE =
  /^VIR(?:EMENT)?\s+(?:SEPA\s+)?(?<payee>.+)/iu;

const LA_BANQUE_POSTALE_ATM_WITHDRAWAL_RE = /^RETRAIT\s+DAB\s+(?<payee>.+)/iu;
const LA_BANQUE_POSTALE_CHEQUE_RE = /^(?:CHEQUE|CHQ)\s+(?<payee>.+)/iu;

const LA_BANQUE_POSTALE_FEE_RE =
  /^(?:FRAIS|COTISATION|COMMISSION)\s+(?<payee>.+)/iu;

const TRAILING_MANDATE_REFERENCE_RE =
  /\s+(?:REF\s*:\s*\S+|MDT\/\S+|ECH\/\S+|ID\s+\S+)$/iu;

const TRAILING_DATE_OR_CARD_RE =
  /\s+(?:CARTE\s+\d{4,}|CB\*?\d{4,}|\d{2}[./]\d{2}(?:[./]\d{2,4})?)$/iu;

const stripBoursoramaLocation = (text: string): string =>
  text.replace(BOURSORAMA_TRAILING_LOCATION_RE, "").trim();

const institutions: readonly InstitutionDef[] = [
  {
    bicPrefixes: ["BOUSFRPP"],
    cleanPayee: stripBoursoramaLocation,
    id: "boursorama",
    nameSubstrings: ["boursorama", "boursobank"],
    noiseLinePatterns: [BOURSORAMA_REFERENCE_LINE_RE],
    patternsInMatchOrder: [
      {
        channel: "atm",
        linePattern: BOURSORAMA_ATM_WITHDRAWAL_RE,
        parseLabelDate: parseDdmmyyOrDdmmyyyyIgnoringSlashes,
      },
      {
        channel: "card",
        linePattern: BOURSORAMA_CARD_REFUND_RE,
        parseLabelDate: parseDdmmyyOrDdmmyyyyIgnoringSlashes,
      },
      {
        channel: "card",
        linePattern: BOURSORAMA_CARD_PAYMENT_RE,
        parseLabelDate: parseDdmmyyOrDdmmyyyyIgnoringSlashes,
      },
      { channel: "direct-debit", linePattern: BOURSORAMA_SEPA_DIRECT_DEBIT_RE },
      { channel: "transfer", linePattern: BOURSORAMA_TRANSFER_RE },
      { channel: "loan", linePattern: BOURSORAMA_LOAN_INSTALMENT_RE },
    ],
  },
  {
    bicPrefixes: ["BNPAFR", "BNPAFRPP"],
    id: "bnp-paribas",
    nameSubstrings: ["bnp", "bnp paribas"],
    patternsInMatchOrder: [
      {
        channel: "card",
        linePattern: BNP_PARIBAS_CARD_PAYMENT_RE,
        parseLabelDate: parseDdmmyy,
      },
      {
        channel: "direct-debit",
        linePattern: BNP_PARIBAS_SEPA_DIRECT_DEBIT_RE,
      },
      { channel: "atm", linePattern: BNP_PARIBAS_ATM_WITHDRAWAL_RE },
      { channel: "transfer", linePattern: BNP_PARIBAS_TRANSFER_RE },
      { channel: "cheque", linePattern: BNP_PARIBAS_CHEQUE_RE },
      { channel: "fee", linePattern: BNP_PARIBAS_FEE_RE },
    ],
  },
  {
    bicPrefixes: ["AGRIFR", "AGRIFRPP"],
    id: "credit-agricole",
    nameSubstrings: ["credit agricole", "crédit agricole"],
    patternsInMatchOrder: [
      { channel: "card", linePattern: CREDIT_AGRICOLE_CARD_PAYMENT_RE },
      {
        channel: "direct-debit",
        linePattern: CREDIT_AGRICOLE_DIRECT_DEBIT_DATED_RE,
        parseLabelDate: parseDdmmyyyySeparated,
      },
      {
        channel: "direct-debit",
        linePattern: CREDIT_AGRICOLE_DIRECT_DEBIT_DAY_MONTH_RE,
      },
      { channel: "direct-debit", linePattern: CREDIT_AGRICOLE_DIRECT_DEBIT_RE },
      { channel: "atm", linePattern: CREDIT_AGRICOLE_ATM_WITHDRAWAL_RE },
      { channel: "transfer", linePattern: CREDIT_AGRICOLE_TRANSFER_RE },
      { channel: "cheque", linePattern: CREDIT_AGRICOLE_CHEQUE_RE },
      { channel: "fee", linePattern: CREDIT_AGRICOLE_FEE_RE },
    ],
  },
  {
    bicPrefixes: ["SOGEFR", "SOGEFRPP"],
    id: "societe-generale",
    nameSubstrings: ["sg ", "societe generale", "société générale"],
    patternsInMatchOrder: [
      { channel: "card", linePattern: SOCIETE_GENERALE_CARD_PAYMENT_RE },
      {
        channel: "transfer",
        extractPayee: (groups) =>
          nonBlankCapture(groups, "motif") ?? nonBlankCapture(groups, "payee"),
        linePattern: SOCIETE_GENERALE_TRANSFER_WITH_MOTIF_RE,
      },
      {
        channel: "unknown",
        linePattern: SOCIETE_GENERALE_DATE_PREFIXED_LINE_RE,
      },
      {
        channel: "direct-debit",
        linePattern: SOCIETE_GENERALE_DIRECT_DEBIT_RE,
      },
      { channel: "atm", linePattern: SOCIETE_GENERALE_ATM_WITHDRAWAL_RE },
      { channel: "transfer", linePattern: SOCIETE_GENERALE_TRANSFER_RE },
      { channel: "fee", linePattern: SOCIETE_GENERALE_FEE_RE },
    ],
  },
  {
    bicPrefixes: ["CMCIFR", "CMCIFRPP"],
    id: "credit-mutuel",
    nameSubstrings: ["cic", "credit mutuel", "crédit mutuel"],
    patternsInMatchOrder: [
      { channel: "card", linePattern: CREDIT_MUTUEL_CARD_PAYMENT_RE },
      {
        channel: "card",
        linePattern: CREDIT_MUTUEL_CARD_PAYMENT_WITHOUT_CARD_RE,
      },
      { channel: "direct-debit", linePattern: CREDIT_MUTUEL_DIRECT_DEBIT_RE },
      { channel: "atm", linePattern: CREDIT_MUTUEL_ATM_WITHDRAWAL_RE },
      { channel: "transfer", linePattern: CREDIT_MUTUEL_TRANSFER_RE },
      { channel: "cheque", linePattern: CREDIT_MUTUEL_CHEQUE_RE },
      { channel: "fee", linePattern: CREDIT_MUTUEL_FEE_RE },
    ],
  },
  {
    bicPrefixes: ["CRLYFR", "CRLYFRPP"],
    id: "lcl",
    nameSubstrings: ["lcl", "le credit lyonnais"],
    patternsInMatchOrder: [
      {
        channel: "card",
        linePattern: LCL_CARD_PAYMENT_RE,
        parseLabelDate: parseDdmmyySlashed,
      },
      { channel: "direct-debit", linePattern: LCL_DIRECT_DEBIT_RE },
      { channel: "atm", linePattern: LCL_ATM_WITHDRAWAL_RE },
      { channel: "transfer", linePattern: LCL_TRANSFER_RE },
      { channel: "cheque", linePattern: LCL_CHEQUE_RE },
      { channel: "fee", linePattern: LCL_FEE_RE },
    ],
  },
  {
    bicPrefixes: ["PSSTFR", "PSSTFRPP"],
    id: "la-banque-postale",
    nameSubstrings: ["banque postale", "la banque postale"],
    patternsInMatchOrder: [
      {
        channel: "card",
        linePattern: LA_BANQUE_POSTALE_CARD_PAYMENT_RE,
        parseLabelDate: parseDdmmyyDotted,
      },
      {
        channel: "direct-debit",
        linePattern: LA_BANQUE_POSTALE_DIRECT_DEBIT_RE,
      },
      { channel: "atm", linePattern: LA_BANQUE_POSTALE_ATM_WITHDRAWAL_RE },
      { channel: "transfer", linePattern: LA_BANQUE_POSTALE_TRANSFER_RE },
      { channel: "cheque", linePattern: LA_BANQUE_POSTALE_CHEQUE_RE },
      { channel: "fee", linePattern: LA_BANQUE_POSTALE_FEE_RE },
    ],
  },
];

const channelVerbsLongestFirst: readonly ChannelVerbPattern[] = [
  [/^PAIEMENT\s+PAR\s+CARTE(?:\s+|$)/iu, "card"],
  [/^FACTURE\s+CARTE(?:\s+|$)/iu, "card"],
  [/^PAIEMENT\s+(?:PSC|CB|MOB)(?:\s+|$)/iu, "card"],
  [/^PRLV\s+(?:EUROPEEN\s+)?SEPA(?:\s+|$)/iu, "direct-debit"],
  [/^PRELEVEMENT(?:\s+SEPA)?(?:\s+|$)/iu, "direct-debit"],
  [/^RETRAIT\s+DAB(?:\s+|$)/iu, "atm"],
  [/^RETRAIT(?:\s+|$)/iu, "atm"],
  [/^VIR(?:EMENT)?(?:\s+(?:SEPA|INST))?(?:\s+|$)/iu, "transfer"],
  [/^ACHAT\s+CB(?:\s+|$)/iu, "card"],
  [/^CARTE(?:\s+|$)/iu, "card"],
  [/^CB(?:\s+|$)/iu, "card"],
  [/^(?:CHEQUE|CHQ)(?:\s+|$)/iu, "cheque"],
  [/^ECH\s+PRET\s*:?\s*/iu, "loan"],
  [/^(?:FRAIS|COTISATION|COMMISSION)(?:\s+|$)/iu, "fee"],
];

const trailingNoiseInStripOrder: readonly RegExp[] = [
  TRAILING_MANDATE_REFERENCE_RE,
  TRAILING_DATE_OR_CARD_RE,
];

export const fr: CountryProfile = {
  channelVerbsLongestFirst,
  code: "FR",
  institutions,
  trailingNoiseInStripOrder,
};
