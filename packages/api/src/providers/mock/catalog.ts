import type { ProviderInstitution } from "../types";

export const MOCK_INSTITUTIONS: readonly Omit<
  ProviderInstitution,
  "country"
>[] = [
  {
    bic: "LUMIFRPPXXX",
    group: "Freenary Mock",
    id: "mock-banque-lumiere",
    name: "Banque Lumière",
  },
  {
    bic: "MISTFRP1XXX",
    group: "Freenary Mock",
    id: "mock-credit-mistral",
    name: "Crédit Mistral",
  },
  {
    bic: "AZURFRP2XXX",
    group: "Freenary Mock",
    id: "mock-neobanque-azur",
    name: "Néobanque Azur",
  },
];

export interface MockMerchant {
  readonly descriptor: string;
  readonly maxEuros: number;
  readonly merchantCategoryCode: string;
  readonly minEuros: number;
  readonly weight: number;
}

export const CARD_MERCHANTS: readonly MockMerchant[] = [
  {
    descriptor: "CARREFOUR MARKET",
    maxEuros: 95,
    merchantCategoryCode: "5411",
    minEuros: 8,
    weight: 9,
  },
  {
    descriptor: "MONOPRIX",
    maxEuros: 70,
    merchantCategoryCode: "5411",
    minEuros: 5,
    weight: 8,
  },
  {
    descriptor: "FRANPRIX",
    maxEuros: 35,
    merchantCategoryCode: "5411",
    minEuros: 3,
    weight: 6,
  },
  {
    descriptor: "LIDL",
    maxEuros: 80,
    merchantCategoryCode: "5411",
    minEuros: 10,
    weight: 5,
  },
  {
    descriptor: "INTERMARCHE",
    maxEuros: 110,
    merchantCategoryCode: "5411",
    minEuros: 12,
    weight: 4,
  },
  {
    descriptor: "PICARD",
    maxEuros: 45,
    merchantCategoryCode: "5411",
    minEuros: 9,
    weight: 2,
  },
  {
    descriptor: "BOULANGERIE PAUL",
    maxEuros: 14,
    merchantCategoryCode: "5462",
    minEuros: 2,
    weight: 7,
  },
  {
    descriptor: "PHARMACIE DE LA GARE",
    maxEuros: 40,
    merchantCategoryCode: "5912",
    minEuros: 4,
    weight: 3,
  },
  {
    descriptor: "SNCF INTERNET",
    maxEuros: 140,
    merchantCategoryCode: "4112",
    minEuros: 15,
    weight: 2,
  },
  {
    descriptor: "UBER TRIP",
    maxEuros: 35,
    merchantCategoryCode: "4121",
    minEuros: 8,
    weight: 2,
  },
  {
    descriptor: "UBER EATS",
    maxEuros: 38,
    merchantCategoryCode: "5814",
    minEuros: 12,
    weight: 3,
  },
  {
    descriptor: "DELIVEROO",
    maxEuros: 36,
    merchantCategoryCode: "5814",
    minEuros: 12,
    weight: 2,
  },
  {
    descriptor: "MCDONALDS",
    maxEuros: 22,
    merchantCategoryCode: "5814",
    minEuros: 6,
    weight: 3,
  },
  {
    descriptor: "FNAC",
    maxEuros: 120,
    merchantCategoryCode: "5732",
    minEuros: 10,
    weight: 1,
  },
  {
    descriptor: "DECATHLON",
    maxEuros: 90,
    merchantCategoryCode: "5941",
    minEuros: 8,
    weight: 1,
  },
  {
    descriptor: "AMAZON PAYMENTS",
    maxEuros: 75,
    merchantCategoryCode: "5999",
    minEuros: 7,
    weight: 3,
  },
  {
    descriptor: "TOTALENERGIES",
    maxEuros: 85,
    merchantCategoryCode: "5541",
    minEuros: 30,
    weight: 2,
  },
  {
    descriptor: "IKEA",
    maxEuros: 160,
    merchantCategoryCode: "5712",
    minEuros: 15,
    weight: 1,
  },
  {
    descriptor: "ZARA",
    maxEuros: 90,
    merchantCategoryCode: "5651",
    minEuros: 20,
    weight: 1,
  },
  {
    descriptor: "PATHE CINEMAS",
    maxEuros: 28,
    merchantCategoryCode: "7832",
    minEuros: 11,
    weight: 1,
  },
];

export interface MockSecurity {
  readonly code: string;
  readonly label: string;
  readonly unitEuros: number;
}

export const SECURITIES: readonly MockSecurity[] = [
  {
    code: "LU1681043599",
    label: "Amundi MSCI World UCITS ETF",
    unitEuros: 520,
  },
  {
    code: "IE00B4L5Y983",
    label: "iShares Core MSCI World UCITS ETF",
    unitEuros: 98,
  },
  {
    code: "IE00B5BMR087",
    label: "iShares Core S&P 500 UCITS ETF",
    unitEuros: 560,
  },
  {
    code: "IE00BK5BQT80",
    label: "Vanguard FTSE All-World UCITS ETF",
    unitEuros: 125,
  },
  { code: "FR0000121014", label: "LVMH", unitEuros: 620 },
  { code: "FR0000120271", label: "TotalEnergies", unitEuros: 58 },
  { code: "FR0000120073", label: "Air Liquide", unitEuros: 175 },
];
