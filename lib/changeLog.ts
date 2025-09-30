// lib/changeLog.ts
import { prisma } from "@/lib/prisma";
import { ChangeAction, ChangeEntity } from "@prisma/client";

type LogArgs = {
  userId: string;
  profileId: string;
  entity: ChangeEntity;
  entityId?: string | null;
  action: ChangeAction;
  field?: string | null;
  before?: any;
  after?: any;
};

export async function logChange(args: LogArgs) {
  const { userId, profileId, entity, entityId, action, field, before, after } = args;
  try {
    await prisma.changeLog.create({
      data: {
        userId,
        profileId,
        entity,
        entityId: entityId ?? null,
        action,
        field: field ?? null,
        before,
        after,
      },
    });
  } catch (e) {
    // non-fatal; avoid blocking the main mutation
    console.error("ChangeLog error", e);
  }
}
