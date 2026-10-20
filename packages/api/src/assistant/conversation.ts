import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import type { UIMessage } from "ai";

export interface AppendTurnOptions {
  answerId: string;
  replaceMessageIds: string[];
}

/* SAFETY: every part is a plain object of JSON values; nothing in the array
   carries a class instance, a function or a Date. Mapping each part restates
   the index signature `Prisma.InputJsonValue` wants, which the SDK's part
   interfaces do not declare, without widening the array through `unknown`. */
const asJson = (parts: UIMessage["parts"]): Prisma.InputJsonArray =>
  parts.map((part) => part as Prisma.InputJsonObject);

export const activeConversation = async (userId: string) => {
  const existing = await prisma.conversation.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
    where: { archivedAt: null, userId },
  });

  return (
    existing ??
    (await prisma.conversation.create({
      data: { userId },
      select: { id: true },
    }))
  );
};

export const conversationMessages = (conversationId: string) =>
  prisma.conversationMessage.findMany({
    orderBy: { ordinal: "asc" },
    select: { id: true, parts: true, role: true },
    where: { conversationId },
  });

export const archiveActiveConversation = (userId: string) =>
  prisma.conversation.updateMany({
    data: { archivedAt: new Date() },
    where: { archivedAt: null, userId },
  });

export const appendTurn = async (
  conversationId: string,
  userParts: UIMessage["parts"],
  assistantParts: UIMessage["parts"],
  { answerId, replaceMessageIds }: AppendTurnOptions
) => {
  await prisma.$transaction(async (tx) => {
    await tx.conversation.update({
      data: { updatedAt: new Date() },
      where: { id: conversationId },
    });

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
