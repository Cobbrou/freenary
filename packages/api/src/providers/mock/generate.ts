import { createHash } from "node:crypto";

import { Faker, base, en, fr } from "@faker-js/faker";
import { Option } from "effect";

import type {
  ProviderAccount,
  ProviderAccountType,
  ProviderHolding,
  ProviderTransaction,
} from "../types";
import { CARD_MERCHANTS, SECURITIES } from "./catalog";
import { openedOnOf } from "./session";

type MockAccountKind = "checking" | "savings" | "pea" | "life-insurance";

interface MockAccountPlan {
  readonly iban?: string;
  readonly kind: MockAccountKind;
  readonly name: string;
  readonly providerAccountId: string;
  readonly type: ProviderAccountType;
}

type DescriptorStyle = "carte" | "paiement-cb" | "cb";

interface MockProfile {
  readonly cardSuffix: string;
  readonly checkingOpeningMinor: number;
  readonly descriptorStyle: DescriptorStyle;
  readonly employer: string;
  readonly holder: string;
  readonly homeCity: string;
  readonly insurer: { readonly amountMinor: number; readonly name: string };
  readonly landlord: string;
  readonly lifeInsuranceContributionMinor: number;
  readonly phone: { readonly amountMinor: number; readonly name: string };
  readonly rentMinor: number;
  readonly salaryMinor: number;
  readonly savingsOpeningMinor: number;
  readonly savingsTransferMinor: number;
}

interface DraftTransaction {
  readonly amountMinor: number;
  readonly creditorIban?: string;
  readonly creditorName?: string;
  readonly debtorIban?: string;
  readonly debtorName?: string;
  readonly merchantCategoryCode?: string;
  readonly pendingToday?: boolean;
  readonly remittance: string;
}

interface DayContext {
  readonly accounts: readonly MockAccountPlan[];
  readonly day: Date;
  readonly isToday: boolean;
  readonly profile: MockProfile;
  readonly providerAccountId: string;
}

const CURRENCY = "EUR";
const BOOKED = "BOOK";
const PENDING = "PDNG";
const CENTS_PER_EURO = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HISTORY_BEFORE_CONSENT_DAYS = 90;
const SESSION_ACCOUNT_SEPARATOR = ":";
const DIACRITICS = /\p{Diacritic}/gu;
const SATURDAY = 6;
const SUNDAY = 0;
const DECEMBER = 11;
const LAST_DAY_OF_DECEMBER = 31;
const SALARY_DAY = 28;
const SAVINGS_TRANSFER_DAY = 2;
const INSURANCE_DAY = 3;
const RENT_DAY = 5;
const PHONE_DAY = 8;
const LIFE_INSURANCE_DAY = 10;
const ELECTRICITY_DAY = 12;
const STREAMING_DAY = 15;
const MUSIC_DAY = 20;
const STREAMING_MINOR = 1349;
const MUSIC_MINOR = 1214;
const LIVRET_A_RATE = 0.024;
const EUROS_FUND_RATE = 0.025;
const DAYS_PER_YEAR = 365;
const PRICE_SWING = 0.04;
const PEA_PROBABILITY = 0.7;
const LIFE_INSURANCE_PROBABILITY = 0.5;
const SUMUP_PROBABILITY = 0.08;
const ATM_PROBABILITY = 0.05;
const REFUND_PROBABILITY = 0.06;
const AWAY_FROM_HOME_PROBABILITY = 0.15;
const ATM_AMOUNTS_EUROS = [20, 40, 50, 60, 100] as const;

const PHONE_PLANS = [
  { amountMinor: 1999, name: "FREE MOBILE" },
  { amountMinor: 2399, name: "SFR" },
  { amountMinor: 2999, name: "ORANGE SA" },
  { amountMinor: 1599, name: "BOUYGUES TELECOM" },
] as const;

const INSURERS = ["MAIF", "MACIF", "AXA FRANCE IARD", "ALLIANZ IARD"] as const;
const REFUND_REASONS = ["REMBOURSEMENT", "RESTO", "COURSES", "CADEAU"] as const;

const DAILY_CARD_COUNTS = [
  { value: 0, weight: 2 },
  { value: 1, weight: 3 },
  { value: 2, weight: 3 },
  { value: 3, weight: 2 },
] as const;

const ACCOUNT_KINDS = {
  checking: { name: "Compte de chèques", type: "CHECKING" },
  "life-insurance": { name: "Assurance vie", type: "LIFE_INSURANCE" },
  pea: { name: "PEA", type: "BROKERAGE" },
  savings: { name: "Livret A", type: "SAVINGS" },
} as const satisfies Record<
  MockAccountKind,
  { name: string; type: ProviderAccountType }
>;

const seededBy = (key: string): Faker => {
  const random = new Faker({ locale: [fr, en, base] });

  random.seed(createHash("sha256").update(key).digest().readUInt32BE(0));

  return random;
};

const bankText = (text: string): string =>
  text.normalize("NFD").replace(DIACRITICS, "").toUpperCase();

const eurosToMinor = (
  random: Faker,
  minEuros: number,
  maxEuros: number
): number =>
  random.number.int({
    max: maxEuros * CENTS_PER_EURO,
    min: minEuros * CENTS_PER_EURO,
  });

const isoDay = (day: Date): string => day.toISOString().slice(0, 10);

const parseDay = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

const twoDigits = (count: number): string => String(count).padStart(2, "0");

const daysBetween = (dateFrom: string, dateTo: string): Date[] => {
  const days: Date[] = [];
  const end = parseDay(dateTo).getTime();

  for (
    let cursor = parseDay(dateFrom).getTime();
    cursor <= end;
    cursor += MS_PER_DAY
  ) {
    days.push(new Date(cursor));
  }

  return days;
};

const frenchMonth = (day: Date): string =>
  bankText(day.toLocaleString("fr-FR", { month: "long", timeZone: "UTC" }));

const salaryDayOf = (day: Date): number => {
  const payday = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), SALARY_DAY)
  );

  while (payday.getUTCDay() === SATURDAY || payday.getUTCDay() === SUNDAY) {
    payday.setUTCDate(payday.getUTCDate() - 1);
  }

  return payday.getUTCDate();
};

export const sessionOf = (providerAccountId: string): string =>
  providerAccountId.split(SESSION_ACCOUNT_SEPARATOR)[0] ?? providerAccountId;

const kindOf = (providerAccountId: string): string =>
  providerAccountId.split(SESSION_ACCOUNT_SEPARATOR)[1] ?? "";

export const planAccounts = (sessionId: string): MockAccountPlan[] => {
  const random = seededBy(`${sessionId}:accounts`);
  const kinds: MockAccountKind[] = ["checking", "savings"];

  if (random.datatype.boolean({ probability: PEA_PROBABILITY })) {
    kinds.push("pea");
  }

  if (random.datatype.boolean({ probability: LIFE_INSURANCE_PROBABILITY })) {
    kinds.push("life-insurance");
  }

  return kinds.map((kind) => ({
    iban:
      kind === "checking" || kind === "savings"
        ? random.finance.iban({ countryCode: "FR", formatted: false })
        : undefined,
    kind,
    name: ACCOUNT_KINDS[kind].name,
    providerAccountId: `${sessionId}${SESSION_ACCOUNT_SEPARATOR}${kind}`,
    type: ACCOUNT_KINDS[kind].type,
  }));
};

const profileOf = (sessionId: string): MockProfile => {
  const random = seededBy(`${sessionId}:profile`);

  return {
    cardSuffix: random.string.numeric(4),
    checkingOpeningMinor: eurosToMinor(random, 800, 4500),
    descriptorStyle: random.helpers.arrayElement([
      "carte",
      "paiement-cb",
      "cb",
    ] as const),
    employer: bankText(random.company.name()),
    holder: bankText(random.person.fullName()),
    homeCity: bankText(random.location.city()),
    insurer: {
      amountMinor: eurosToMinor(random, 22, 75),
      name: random.helpers.arrayElement(INSURERS),
    },
    landlord: bankText(random.person.fullName()),
    lifeInsuranceContributionMinor:
      random.number.int({ max: 6, min: 1 }) * 50 * CENTS_PER_EURO,
    phone: random.helpers.arrayElement(PHONE_PLANS),
    rentMinor: random.number.int({ max: 28, min: 13 }) * 50 * CENTS_PER_EURO,
    salaryMinor: eurosToMinor(random, 2100, 4600),
    savingsOpeningMinor: eurosToMinor(random, 1500, 22_000),
    savingsTransferMinor:
      random.number.int({ max: 8, min: 1 }) * 50 * CENTS_PER_EURO,
  };
};

const cardRemittance = (
  profile: MockProfile,
  day: Date,
  merchant: string,
  city: string
): string => {
  const dd = twoDigits(day.getUTCDate());
  const mm = twoDigits(day.getUTCMonth() + 1);
  const yy = String(day.getUTCFullYear()).slice(2);

  const styles = {
    carte: `CARTE ${dd}/${mm} ${merchant} ${city}`,
    cb: `CB ${merchant} ${dd}/${mm}/${yy}`,
    "paiement-cb": `PAIEMENT CB ${dd}${mm} ${merchant} CARTE ${profile.cardSuffix}`,
  } satisfies Record<DescriptorStyle, string>;

  return styles[profile.descriptorStyle];
};

const ibanOf = (
  accounts: readonly MockAccountPlan[],
  kind: MockAccountKind
): string | undefined =>
  accounts.find((account) => account.kind === kind)?.iban;

const hasAccount = (
  accounts: readonly MockAccountPlan[],
  kind: MockAccountKind
): boolean => accounts.some((account) => account.kind === kind);

const checkingRecurring = (context: DayContext): DraftTransaction[] => {
  const { accounts, day, profile, providerAccountId } = context;
  const date = day.getUTCDate();
  const drafts: DraftTransaction[] = [];
  const monthKey = `${providerAccountId}:${isoDay(day).slice(0, 7)}`;

  if (date === salaryDayOf(day)) {
    drafts.push({
      amountMinor: profile.salaryMinor,
      debtorName: profile.employer,
      remittance: `VIR SEPA RECU /DE ${profile.employer} /MOTIF SALAIRE ${frenchMonth(day)} ${day.getUTCFullYear()}`,
    });
  }

  if (date === SAVINGS_TRANSFER_DAY) {
    drafts.push({
      amountMinor: -profile.savingsTransferMinor,
      creditorIban: ibanOf(accounts, "savings"),
      creditorName: profile.holder,
      remittance: "VIR SEPA EMIS VERS LIVRET A",
    });
  }

  if (date === INSURANCE_DAY) {
    drafts.push({
      amountMinor: -profile.insurer.amountMinor,
      creditorName: profile.insurer.name,
      remittance: `PRLV SEPA ${profile.insurer.name} ASSURANCE HABITATION`,
    });
  }

  if (date === RENT_DAY) {
    drafts.push({
      amountMinor: -profile.rentMinor,
      creditorName: profile.landlord,
      remittance: `VIR SEPA EMIS /A ${profile.landlord} /MOTIF LOYER ${frenchMonth(day)}`,
    });
  }

  if (date === PHONE_DAY) {
    drafts.push({
      amountMinor: -profile.phone.amountMinor,
      creditorName: profile.phone.name,
      remittance: `PRLV SEPA ${profile.phone.name}`,
    });
  }

  if (date === LIFE_INSURANCE_DAY && hasAccount(accounts, "life-insurance")) {
    drafts.push({
      amountMinor: -profile.lifeInsuranceContributionMinor,
      creditorName: profile.holder,
      remittance: "VIR SEPA EMIS VERS ASSURANCE VIE VERSEMENT PROGRAMME",
    });
  }

  if (date === ELECTRICITY_DAY) {
    drafts.push({
      amountMinor: -eurosToMinor(seededBy(`${monthKey}:edf`), 48, 145),
      creditorName: "EDF",
      remittance: "PRLV SEPA EDF CLIENTS PARTICULIERS",
    });
  }

  if (date === STREAMING_DAY) {
    drafts.push({
      amountMinor: -STREAMING_MINOR,
      merchantCategoryCode: "4899",
      pendingToday: true,
      remittance: cardRemittance(profile, day, "NETFLIX.COM", "AMSTERDAM"),
    });
  }

  if (date === MUSIC_DAY) {
    drafts.push({
      amountMinor: -MUSIC_MINOR,
      merchantCategoryCode: "5815",
      pendingToday: true,
      remittance: cardRemittance(profile, day, "SPOTIFY", "STOCKHOLM"),
    });
  }

  return drafts;
};

const checkingEveryday = (context: DayContext): DraftTransaction[] => {
  const { day, profile, providerAccountId } = context;
  const random = seededBy(`${providerAccountId}:${isoDay(day)}`);
  const drafts: DraftTransaction[] = [];
  const cardCount = random.helpers.weightedArrayElement([...DAILY_CARD_COUNTS]);

  for (let purchase = 0; purchase < cardCount; purchase += 1) {
    const city = random.datatype.boolean({
      probability: AWAY_FROM_HOME_PROBABILITY,
    })
      ? bankText(random.location.city())
      : profile.homeCity;

    if (random.datatype.boolean({ probability: SUMUP_PROBABILITY })) {
      drafts.push({
        amountMinor: -eurosToMinor(random, 3, 30),
        pendingToday: true,
        remittance: cardRemittance(
          profile,
          day,
          `SUMUP *${bankText(random.person.lastName())}`,
          city
        ),
      });

      continue;
    }

    const merchant = random.helpers.weightedArrayElement(
      CARD_MERCHANTS.map((candidate) => ({
        value: candidate,
        weight: candidate.weight,
      }))
    );

    drafts.push({
      amountMinor: -eurosToMinor(random, merchant.minEuros, merchant.maxEuros),
      merchantCategoryCode: merchant.merchantCategoryCode,
      pendingToday: true,
      remittance: cardRemittance(profile, day, merchant.descriptor, city),
    });
  }

  if (random.datatype.boolean({ probability: ATM_PROBABILITY })) {
    const dd = twoDigits(day.getUTCDate());
    const mm = twoDigits(day.getUTCMonth() + 1);
    const yy = String(day.getUTCFullYear()).slice(2);

    drafts.push({
      amountMinor:
        -random.helpers.arrayElement(ATM_AMOUNTS_EUROS) * CENTS_PER_EURO,
      merchantCategoryCode: "6011",
      remittance: `RETRAIT DAB ${dd}/${mm}/${yy} ${profile.homeCity} CB*${profile.cardSuffix}`,
    });
  }

  if (random.datatype.boolean({ probability: REFUND_PROBABILITY })) {
    const friend = bankText(random.person.fullName());

    drafts.push({
      amountMinor: eurosToMinor(random, 5, 60),
      debtorIban: random.finance.iban({ countryCode: "FR", formatted: false }),
      debtorName: friend,
      remittance: `VIR INST ${friend} ${random.helpers.arrayElement(REFUND_REASONS)}`,
    });
  }

  return drafts;
};

const savingsDay = (context: DayContext): DraftTransaction[] => {
  const { accounts, day, profile } = context;
  const drafts: DraftTransaction[] = [];

  if (day.getUTCDate() === SAVINGS_TRANSFER_DAY) {
    drafts.push({
      amountMinor: profile.savingsTransferMinor,
      debtorIban: ibanOf(accounts, "checking"),
      debtorName: profile.holder,
      remittance: `VIR SEPA RECU DE ${profile.holder} VERS LIVRET A`,
    });
  }

  const isYearEnd =
    day.getUTCMonth() === DECEMBER && day.getUTCDate() === LAST_DAY_OF_DECEMBER;

  if (isYearEnd) {
    drafts.push({
      amountMinor: Math.round(profile.savingsOpeningMinor * LIVRET_A_RATE),
      remittance: `INTERETS CREDITEURS ${day.getUTCFullYear()}`,
    });
  }

  return drafts;
};

const lifeInsuranceDay = (context: DayContext): DraftTransaction[] =>
  context.day.getUTCDate() === LIFE_INSURANCE_DAY
    ? [
        {
          amountMinor: context.profile.lifeInsuranceContributionMinor,
          debtorIban: ibanOf(context.accounts, "checking"),
          debtorName: context.profile.holder,
          remittance: "VERSEMENT PROGRAMME",
        },
      ]
    : [];

const DAY_GENERATORS = {
  checking: (context) => [
    ...checkingRecurring(context),
    ...checkingEveryday(context),
  ],
  "life-insurance": lifeInsuranceDay,
  pea: () => [],
  savings: savingsDay,
} satisfies Record<
  MockAccountKind,
  (context: DayContext) => DraftTransaction[]
>;

const isMockAccountKind = (kind: string): kind is MockAccountKind =>
  Object.hasOwn(DAY_GENERATORS, kind);

const toProviderTransaction = (
  draft: DraftTransaction,
  id: string,
  context: DayContext
): ProviderTransaction => {
  const iso = isoDay(context.day);
  const isPending = context.isToday && draft.pendingToday === true;

  return {
    amountMinor: draft.amountMinor,
    bookingDate: iso,
    creditorIban: draft.creditorIban,
    creditorName: draft.creditorName,
    currency: CURRENCY,
    debtorIban: draft.debtorIban,
    debtorName: draft.debtorName,
    merchantCategoryCode: draft.merchantCategoryCode,
    providerTransactionId: id,
    remittanceLines: [draft.remittance],
    status: isPending ? PENDING : BOOKED,
    transactionDate: iso,
    valueDate: iso,
  };
};

export const generateTransactions = (
  providerAccountId: string,
  dateFrom: string,
  dateTo: string,
  today: Date
): ProviderTransaction[] => {
  const kind = kindOf(providerAccountId);

  if (!isMockAccountKind(kind)) {
    return [];
  }

  const sessionId = sessionOf(providerAccountId);
  const accounts = planAccounts(sessionId);
  const profile = profileOf(sessionId);
  const todayIso = isoDay(today);
  const lastDay = dateTo < todayIso ? dateTo : todayIso;

  return daysBetween(dateFrom, lastDay).flatMap((day) => {
    const context: DayContext = {
      accounts,
      day,
      isToday: isoDay(day) === todayIso,
      profile,
      providerAccountId,
    };

    return DAY_GENERATORS[kind](context).map((draft, index) =>
      toProviderTransaction(
        draft,
        `${providerAccountId}:${isoDay(day)}:${index}`,
        context
      )
    );
  });
};

const fractionOfYear = (today: Date): number =>
  (today.getTime() - Date.UTC(today.getUTCFullYear(), 0, 1)) /
  MS_PER_DAY /
  DAYS_PER_YEAR;

const securityHolding = (
  providerAccountId: string,
  security: (typeof SECURITIES)[number],
  today: Date
): ProviderHolding => {
  const position = seededBy(`${providerAccountId}:${security.code}`);
  const quantity = Math.max(
    1,
    Math.round(
      position.number.int({ max: 12_000, min: 1500 }) / security.unitEuros
    )
  );

  const unitCost =
    security.unitEuros *
    position.number.float({ fractionDigits: 4, max: 1.05, min: 0.78 });

  const quote = seededBy(
    `${providerAccountId}:${security.code}:${isoDay(today)}`
  );

  const unitValue =
    security.unitEuros *
    (1 +
      quote.number.float({
        fractionDigits: 4,
        max: PRICE_SWING,
        min: -PRICE_SWING,
      }));

  const valuationMinor = Math.round(quantity * unitValue * CENTS_PER_EURO);
  const costMinor = Math.round(quantity * unitCost * CENTS_PER_EURO);

  return {
    code: security.code,
    codeType: "ISIN",
    currency: CURRENCY,
    label: security.label,
    providerHoldingId: `${providerAccountId}:${security.code}`,
    quantity: String(quantity),
    unitCost: unitCost.toFixed(4),
    unitValue: unitValue.toFixed(4),
    unrealisedGainMinor: valuationMinor - costMinor,
    valuationMinor,
    valuedAt: isoDay(today),
  };
};

const eurosFundHolding = (
  providerAccountId: string,
  today: Date
): ProviderHolding => {
  const principalMinor = eurosToMinor(
    seededBy(`${providerAccountId}:fonds-euros`),
    4000,
    45_000
  );

  const valuationMinor = Math.round(
    principalMinor * (1 + EUROS_FUND_RATE * fractionOfYear(today))
  );

  return {
    currency: CURRENCY,
    label: "Fonds euros",
    providerHoldingId: `${providerAccountId}:fonds-euros`,
    quantity: "1",
    unitCost: (principalMinor / CENTS_PER_EURO).toFixed(2),
    unitValue: (valuationMinor / CENTS_PER_EURO).toFixed(2),
    unrealisedGainMinor: valuationMinor - principalMinor,
    valuationMinor,
    valuedAt: isoDay(today),
  };
};

export const generateHoldings = (
  providerAccountId: string,
  today: Date
): ProviderHolding[] => {
  const kind = kindOf(providerAccountId);

  if (kind !== "pea" && kind !== "life-insurance") {
    return [];
  }

  const picks = seededBy(
    `${providerAccountId}:portfolio`
  ).helpers.arrayElements(SECURITIES, { max: 4, min: 2 });

  const securities = picks.map((security) =>
    securityHolding(providerAccountId, security, today)
  );

  return kind === "life-insurance"
    ? [eurosFundHolding(providerAccountId, today), ...securities]
    : securities;
};

const sumMinor = (amounts: readonly { amountMinor: number }[]): number =>
  amounts.reduce((total, entry) => total + entry.amountMinor, 0);

const ledgerStartOf = (sessionId: string, today: Date): string => {
  const openedOn = Option.match(openedOnOf(sessionId), {
    onNone: () => today,
    onSome: parseDay,
  });

  return isoDay(
    new Date(openedOn.getTime() - HISTORY_BEFORE_CONSENT_DAYS * MS_PER_DAY)
  );
};

const balanceOf = (
  plan: MockAccountPlan,
  profile: MockProfile,
  today: Date
): number => {
  if (plan.kind === "pea" || plan.kind === "life-insurance") {
    return generateHoldings(plan.providerAccountId, today).reduce(
      (total, holding) => total + holding.valuationMinor,
      0
    );
  }

  const opening =
    plan.kind === "checking"
      ? profile.checkingOpeningMinor
      : profile.savingsOpeningMinor;

  const history = generateTransactions(
    plan.providerAccountId,
    ledgerStartOf(sessionOf(plan.providerAccountId), today),
    isoDay(today),
    today
  );

  return opening + sumMinor(history);
};

export const generateAccounts = (
  sessionId: string,
  today: Date
): ProviderAccount[] => {
  const profile = profileOf(sessionId);

  return planAccounts(sessionId).map((plan) => ({
    balanceAt: today.toISOString(),
    balanceMinor: balanceOf(plan, profile, today),
    currency: CURRENCY,
    iban: plan.iban,
    name: plan.name,
    providerAccountId: plan.providerAccountId,
    type: plan.type,
  }));
};
