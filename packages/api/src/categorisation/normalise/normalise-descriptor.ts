const IDENTITY_FREE_TOKENS = {
  ab: true,
  achat: true,
  ag: true,
  aps: true,
  as: true,
  au: true,
  aux: true,
  avoir: true,
  bv: true,
  card: true,
  carte: true,
  cb: true,
  cheque: true,
  chq: true,
  co: true,
  contactless: true,
  credit: true,
  dab: true,
  de: true,
  debit: true,
  des: true,
  differe: true,
  direct: true,
  du: true,
  ech: true,
  ei: true,
  eirl: true,
  et: true,
  eurl: true,
  facture: true,
  gie: true,
  gmbh: true,
  immediat: true,
  inc: true,
  inst: true,
  kg: true,
  la: true,
  le: true,
  les: true,
  llc: true,
  ltd: true,
  mandat: true,
  mdt: true,
  mob: true,
  nv: true,
  ohg: true,
  operation: true,
  oy: true,
  paiement: true,
  par: true,
  payment: true,
  payweb: true,
  plc: true,
  prelevement: true,
  pret: true,
  prlv: true,
  psc: true,
  purchase: true,
  ref: true,
  reference: true,
  remise: true,
  retrait: true,
  sa: true,
  sarl: true,
  sas: true,
  sasu: true,
  sci: true,
  scop: true,
  sepa: true,
  snc: true,
  spa: true,
  srl: true,
  transfer: true,
  uab: true,
  un: true,
  une: true,
  vir: true,
  virement: true,
  withdrawal: true,
} as const satisfies Record<string, true>;

const COMBINING_MARKS = /[\u0300-\u036F]/gu;
const REMOVED_APOSTROPHES = /['\u2019\u02BC`]/gu;
const TOKEN_SEPARATORS = /[^a-z0-9]+/gu;
const CONTAINS_DIGIT = /[0-9]/u;

const carriesMerchantIdentity = (token: string): boolean =>
  !CONTAINS_DIGIT.test(token) && !Object.hasOwn(IDENTITY_FREE_TOKENS, token);

export const normaliseTokens = (text: string): string[] => {
  const folded = text
    .replaceAll("œ", "oe")
    .replaceAll("Œ", "oe")
    .replaceAll("æ", "ae")
    .replaceAll("Æ", "ae")
    .normalize("NFD")
    .replaceAll(COMBINING_MARKS, "")
    .toLowerCase()
    .replaceAll(REMOVED_APOSTROPHES, "")
    .replaceAll(TOKEN_SEPARATORS, " ");

  const tokens: string[] = [];

  for (const token of folded.split(" ")) {
    if (token.length > 0 && carriesMerchantIdentity(token)) {
      tokens.push(token);
    }
  }

  return tokens;
};

export const normaliseDescriptor = (text: string): string =>
  normaliseTokens(text).join(" ");
