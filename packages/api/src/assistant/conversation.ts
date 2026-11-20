import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import type { UIMessage } from "ai";
import { z } from "zod";

import { conversationTitle, questionText } from "./conversation-title";

export interface AppendTurnOptions {
  answerId: string;
  replaceMessageIds: string[];
}

export const CONVERSATIONS_LISTED = 50;

const storedPartsSchema = z.array(
  z.looseObject({ text: z.string().optional(), type: z.string() })
);

const storedQuestion = (parts: Prisma.JsonValue | undefined): string => {
  const parsed = storedPartsSchema.safeParse(parts);

  return parsed.success ? questionText(parsed.data) : "";
};

/* SAFETY: every part is a plain object of JSON values; nothing in the array
   carries a class instance, a function or a Date. Mapping each part restates
   the index signature `Prisma.InputJsonValue` wants, which the SDK's part
   interfaces do not declare, without widening the array through `unknown`. */
const asJson = (parts: UIMessage["parts"]): Prisma.InputJsonArray =>
  parts.map((part) => part as Prisma.InputJsonObject);

export const ownedConversation = (userId: string, conversationId: string) =>
  prisma.conversation.findFirst({
    select: { id: true, title: true },
    where: { id: conversationId, userId },
  });

export const createConversation = (userId: string) =>
  prisma.conversation.create({ data: { userId }, select: { id: true } });

export const listConversations = async (userId: string) => {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      messages: {
        orderBy: { ordinal: "asc" },
        select: { parts: true },
        take: 1,
      },
      title: true,
      updatedAt: true,
    },
    take: CONVERSATIONS_LISTED,
    where: { messages: { some: {} }, userId },
  });

  return conversations.map(({ id, messages, title, updatedAt }) => ({
    id,
    title: title ?? conversationTitle(storedQuestion(messages[0]?.parts)),
    updatedAt,
  }));
};

export const deleteConversation = (userId: string, conversationId: string) =>
  prisma.conversation.deleteMany({ where: { id: conversationId, userId } });

export const conversationMessages = (conversationId: string) =>
  prisma.conversationMessage.findMany({
    orderBy: { ordinal: "asc" },
    select: { id: true, parts: true, role: true },
    where: { conversationId },
  });

export const appendTurn = async (
  conversationId: string,
  userParts: UIMessage["parts"],
  assistantParts: UIMessage["parts"],
  { answerId, replaceMessageIds }: AppendTurnOptions
) => {
  const title = conversationTitle(questionText(userParts));

  await prisma.$transaction(async (tx) => {
    await tx.conversation.update({
      data: { updatedAt: new Date() },
      where: { id: conversationId },
    });

    if (title !== null) {
      await tx.conversation.updateMany({
        data: { title },
        where: { id: conversationId, title: null },
      });
    }

    if (replaceMessageIds.length > 0) {
      await tx.conversationMessage.deleteMany({
        where: { conversationId, id: { in: replaceMessageIds } },
      });
    }

    const last = await tx.conversationMessage.findFirst({
      orderBy: { ordinal: "desc" },
      select: { ordinal: true },
      where: { conversationId },
    });

    const next = (last?.ordinal ?? -1) + 1;

    await tx.conversationMessage.createMany({
      data: [
        {
          conversationId,
          ordinal: next,
          parts: asJson(userParts),
          role: "USER",
        },
        {
          conversationId,
          id: answerId,
          ordinal: next + 1,
          parts: asJson(assistantParts),
          role: "ASSISTANT",
        },
      ],
    });
  });
};
