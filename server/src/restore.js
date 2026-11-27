import { database } from './db.js';
import { ApiError } from './validation.js';
import { csrf } from './auth.js';

// Each router already verifies the session and ownership of the parent pet.
export function addRestoreRoute(router, model, prefix) {
  router.post('/:id/restore', csrf, async (req, res) => {
    const { petId, id } = req.params;
    const version = req.body?.version;
    if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) throw new ApiError(404, prefix + '_NOT_FOUND');
    if (!Number.isSafeInteger(version) || version < 2 || version >= 2147483647) throw new ApiError(400, 'INVALID_INPUT');
    await database().$transaction(async tx => {
      // Serialize with routine stops, and make concurrent restore retries harmless.
      await tx.$queryRaw`SELECT id FROM "Pet" WHERE id = ${petId}::uuid FOR UPDATE`;
      const where = { petId, id };
      const item = await tx[model].findFirst({ where });
      if (!item) throw new ApiError(404, prefix + '_NOT_FOUND');
      if (!item.deletedAt && item.version === version + 1) return;
      if (!item.deletedAt || item.version !== version) throw new ApiError(409, prefix + '_CHANGED');
      if (model === 'careTask' && item.routineId) {
        const rule = await tx.careRoutine.findUnique({ where: { id: item.routineId }, select: { stopDay: true } });
        if (rule?.stopDay && item.day >= rule.stopDay) throw new ApiError(409, 'TASK_CHANGED');
      }
      const changed = await tx[model].updateMany({
        where: { ...where, version, deletedAt: { not: null } },
        data: { deletedAt: null, version: { increment: 1 } },
      });
      if (!changed.count) throw new ApiError(409, prefix + '_CHANGED');
      if (model === 'careTask') await tx.careEvent.create({ data: {
        taskId: id, action: 'restored', title: item.title, version: version + 1,
        targetCount: item.targetCount, completedCount: item.completedCount,
      } });
    });
    res.status(204).end();
  });
}
