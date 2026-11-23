import type { SpendingCategory } from "../../lib/taxonomy";
import { categoriesForDirection } from "../../lib/taxonomy";
import type { TransactionDirection } from "./types";

interface ChoiceQuestion {
  criteria: Record<string, string>;
  instructions: string;
  type: "choice";
}

export const CATEGORY_QUESTION_ID = "category";

export const CATEGORY_INSTRUCTIONS =
  "Which category best describes this bank transaction? Read the descriptor, merchant and counterparty together with the payment facts: amount bucket, channel and merchant category code. The options already match the direction of the transaction.";

export const CATEGORY_CRITERIA = {
  benefits:
    "A benefit, allowance, pension or other payment from a state body or a pension fund",
  "bills-utilities":
    "Electricity, gas, water, heating, waste, internet, mobile or landline telephone",
  "car-fuel":
    "Fuel, charging, parking, tolls, servicing, repair or anything else a private vehicle costs",
  "cash-withdrawal": "Cash taken from or paid into an account",
  crypto: "The purchase of a cryptocurrency or a payment to a crypto exchange",
  entertainment:
    "Cinema, concerts, sport, games, hobbies, books and other leisure, but not a recurring subscription",
  "family-education":
    "Childcare, school, university, tuition, child support and other family costs",
  groceries: "Food and household shopping from a shop or a supermarket",
  health:
    "A doctor, a dentist, a hospital, a pharmacy, an optician or a health insurance premium",
  "investment-income":
    "A dividend, an interest payment, a coupon or the proceeds of a sale of an investment",
  "loans-bank-fees":
    "A loan repayment, credit interest, an account fee, a card fee or another bank charge",
  "other-income": "Money received that no other income category describes",
  people:
    "Money sent to or received from a private individual, such as a friend or a relative",
  refunds:
    "A refund, a reimbursement, a returned payment or an insurance claim settlement",
  "rent-mortgage":
    "Rent, a mortgage instalment, a service charge or property tax on a home",
  "rental-income": "Rent received from a property that the account holder lets",
  restaurants:
    "A restaurant, a cafe, a bar, a takeaway or a food delivery service",
  retirement:
    "A payment into a pension plan or another long-term retirement product",
  salary: "Pay from an employer, including wages, a bonus and expenses repaid",
  savings:
    "A transfer into a savings account or another product held to keep money",
  securities:
    "The purchase of shares, bonds, funds or another market security, and a payment to a broker",
  "self-employment":
    "Money a customer or a client pays for work the account holder did",
  shopping:
    "Clothes, electronics, furniture, gifts and other goods that are not food",
  subscriptions:
    "A recurring charge for a service, such as streaming, software or a membership",
  taxes: "Income tax, a social contribution or another payment to a tax office",
  "transport-travel":
    "A train, a bus, a plane, a taxi, a hotel or another journey away from home",
  uncategorised:
    "The text does not say what was bought or paid, and no other category fits with reasonable certainty",
} as const satisfies Record<SpendingCategory, string>;

const OFFERED_BY_DIRECTION = {
  credit: categoriesForDirection("incoming"),
  debit: categoriesForDirection("outgoing"),
} as const satisfies Record<TransactionDirection, readonly SpendingCategory[]>;

export const offeredCategories = (
  direction: TransactionDirection
): readonly SpendingCategory[] => OFFERED_BY_DIRECTION[direction];

export const isOfferedCategory = (
  value: string,
  direction: TransactionDirection
): value is SpendingCategory =>
  OFFERED_BY_DIRECTION[direction].some((category) => category === value);

const ASSIGNABLE_BY_DIRECTION = {
  credit: OFFERED_BY_DIRECTION.credit.filter(
    (category) => category !== "uncategorised"
  ),
  debit: OFFERED_BY_DIRECTION.debit.filter(
    (category) => category !== "uncategorised"
  ),
} as const satisfies Record<TransactionDirection, readonly SpendingCategory[]>;

export const assignableCategories = (
  direction: TransactionDirection
): readonly SpendingCategory[] => ASSIGNABLE_BY_DIRECTION[direction];

export const isAssignableCategory = (
  value: string,
  direction: TransactionDirection
): value is SpendingCategory =>
  ASSIGNABLE_BY_DIRECTION[direction].some((category) => category === value);

const questionsFor = (offered: readonly SpendingCategory[]) => ({
  [CATEGORY_QUESTION_ID]: {
    criteria: Object.fromEntries(
      offered.map((category) => [category, CATEGORY_CRITERIA[category]])
    ),
    instructions: CATEGORY_INSTRUCTIONS,
    type: "choice",
  } satisfies ChoiceQuestion,
});

export const QUESTIONS_BY_DIRECTION = {
  credit: questionsFor(ASSIGNABLE_BY_DIRECTION.credit),
  debit: questionsFor(ASSIGNABLE_BY_DIRECTION.debit),
} as const satisfies Record<
  TransactionDirection,
  Record<string, ChoiceQuestion>
>;
