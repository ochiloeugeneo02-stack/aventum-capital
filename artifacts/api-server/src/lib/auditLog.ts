import { db, auditLogsTable } from "@workspace/db";

export async function createAuditLog(params: {
  action: string;
  performedBy: number;
  targetType: string;
  targetId?: number;
  details?: string;
}): Promise<void> {
  await db.insert(auditLogsTable).values(params);
}
