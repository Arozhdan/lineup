import { db } from "../db/client.js";
import { auditLog } from "../db/schema.js";

export async function audit(actorId: number, action: string, target: string, reason = ""): Promise<void> {
  await db.insert(auditLog).values({ actorId, action, target, reason });
}
