import { getD1, writeAudit } from "./database";
import type { Role } from "./types";

export type NotificationInput = {
  recipientAccountId: string;
  type: string;
  title: string;
  content: string;
  relatedType?: string | null;
  relatedId?: string | null;
};

export async function createNotification(input: NotificationInput): Promise<string> {
  const id = crypto.randomUUID();
  await getD1().prepare(`
    INSERT INTO notifications (id, recipient_account_id, type, title, content, related_type, related_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.recipientAccountId,
    input.type,
    input.title,
    input.content,
    input.relatedType ?? null,
    input.relatedId ?? null,
  ).run();
  return id;
}

export async function notifyRoles(
  roles: Role[],
  input: Omit<NotificationInput, "recipientAccountId">,
  actorAccountId: string | null = null,
): Promise<void> {
  const placeholders = roles.map(() => "?").join(",");
  const recipients = await getD1().prepare(`SELECT id FROM accounts WHERE role IN (${placeholders}) AND status = 'active'`)
    .bind(...roles)
    .all<{ id: string }>();
  if (recipients.results.length) {
    await getD1().batch(recipients.results.map((row) => getD1().prepare(`
      INSERT INTO notifications (id, recipient_account_id, type, title, content, related_type, related_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), row.id, input.type, input.title, input.content, input.relatedType ?? null, input.relatedId ?? null)));
  }
  if (actorAccountId) {
    await writeAudit(actorAccountId, "notification.create", "notification", input.relatedId ?? null, {
      recipientRoles: roles,
      type: input.type,
      relatedType: input.relatedType ?? null,
    });
  }
}