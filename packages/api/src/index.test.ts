import { beforeAll, describe, expect, it } from "bun:test";

import prisma from "@freenary/db";
import { startTestDatabase } from "@freenary/db/testing";
import type { AnyProcedure, AnyRouter, Lazyable } from "@orpc/server";
import { call, isLazy, isProcedure } from "@orpc/server";

import type { Context } from "./context";
import { operatorProcedure, protectedProcedure } from "./index";
import { appRouter } from "./routers/index";
import { codeOf, contextOf, guestContext } from "./testing";

const OPERATOR = "authorization-operator";
const MEMBER = "authorization-member";
const DELETED = "authorization-deleted";

const PUBLIC_PROCEDURES = [
  "auth.capabilities",
  "auth.viewer",
  "healthCheck",
  "instance.status",
];

const OPERATOR_PROCEDURES = [
  "instance.bankConnectionCount",
  "instance.check",
  "instance.complete",
  "instance.describe",
  "instance.save",
];

interface NamedProcedure {
  readonly name: string;
  readonly procedure: AnyProcedure;
}

const proceduresOf = (
  router: Lazyable<AnyRouter>,
  name: string
): NamedProcedure[] => {
  if (isLazy(router)) {
    throw new TypeError(`${name} is lazy, and this walk would miss it`);
  }

  return isProcedure(router)
    ? [{ name, procedure: router }]
    : Object.entries(router).flatMap(([key, child]) =>
        proceduresOf(child, name === "" ? key : `${name}.${key}`)
      );
};

const answersOf = (
  procedures: readonly NamedProcedure[],
  context: Context
): Promise<{ code: string; name: string }[]> =>
  Promise.all(
    procedures.map(async ({ name, procedure }) => ({
      code: await codeOf(call(procedure, undefined, { context })),
      name,
    }))
  );

const namesOf = (
  answers: readonly { code: string; name: string }[],
  isKept: (code: string) => boolean
): string[] =>
  answers.flatMap(({ code, name }) => (isKept(code) ? [name] : [])).toSorted();

const withApiKey = (header: string, value: string): Context =>
  contextOf(OPERATOR, new Headers({ [header]: value }));

beforeAll(async () => {
  await startTestDatabase();

  await prisma.user.createMany({
    data: [
      {
        email: "operator@authorization.test",
        firstName: OPERATOR,
        id: OPERATOR,
        role: "OPERATOR",
      },
      { email: "member@authorization.test", firstName: MEMBER, id: MEMBER },
    ],
  });
});

describe("protectedProcedure", () => {
  const procedure = protectedProcedure.handler(
    ({ context }) => context.session.user.id
  );

  it("refuses a guest", async () => {
    expect(
      await codeOf(call(procedure, undefined, { context: guestContext() }))
    ).toBe("UNAUTHORIZED");
  });

  it("hands the handler the caller's session", async () => {
    expect(
      await call(procedure, undefined, { context: contextOf(MEMBER) })
    ).toBe(MEMBER);
  });
});

describe("operatorProcedure", () => {
  const procedure = operatorProcedure.handler(() => "answer");

  it.each([
    ["UNAUTHORIZED", "a guest", guestContext()],
    ["FORBIDDEN", "a member", contextOf(MEMBER)],
    ["FORBIDDEN", "an account that is gone", contextOf(DELETED)],
    [
      "FORBIDDEN",
      "the operator's x-api-key",
      withApiKey("x-api-key", "fny_key"),
    ],
    [
      "FORBIDDEN",
      "the operator's bearer key",
      withApiKey("authorization", "Bearer fny_key"),
    ],
    ["OK", "the operator", contextOf(OPERATOR)],
  ])("answers %s to %s", async (code, _caller, context) => {
    expect(await codeOf(call(procedure, undefined, { context }))).toBe(code);
  });
});

describe("appRouter", () => {
  it("answers a guest on the public procedures alone", async () => {
    const answers = await answersOf(
      proceduresOf(appRouter, ""),
      guestContext()
    );

    expect(namesOf(answers, (code) => code !== "UNAUTHORIZED")).toEqual(
      PUBLIC_PROCEDURES
    );

    expect(namesOf(answers, (code) => code === "OK")).toEqual(
      PUBLIC_PROCEDURES
    );
  });

  it("answers the instance procedures of the operator to the operator alone", async () => {
    const answers = await answersOf(
      proceduresOf(appRouter.instance, "instance"),
      contextOf(MEMBER)
    );

    expect(namesOf(answers, (code) => code === "FORBIDDEN")).toEqual(
      OPERATOR_PROCEDURES
    );
  });
});
