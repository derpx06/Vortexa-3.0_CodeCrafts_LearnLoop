/**
 * GET /api/stages/visibility — ids of the caller's own courses that are
 * public, so the library can show each card's publish state without changing
 * the document summary shape.
 */
import { NextResponse } from 'next/server';

import { isServerPersistenceConfigured } from '@/lib/config/feature-flags';
import { withRequestOwner } from '@/lib/server/identity/with-owner';
import { getStageAccessDb } from '@/lib/server/stage-access';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!isServerPersistenceConfigured()) return NextResponse.json({ publicIds: [] });

  return withRequestOwner(req, async (principal, responseHeaders) => {
    responseHeaders.set('Cache-Control', 'no-store');
    const db = await getStageAccessDb();
    const { rows } = await db.query<{ stage_id: string }>(
      `SELECT stage_id FROM stage_meta
        WHERE owner_id = $1 AND is_public AND deleted_at IS NULL`,
      [principal.ownerId],
    );
    return NextResponse.json(
      { publicIds: rows.map((row) => row.stage_id) },
      { headers: responseHeaders },
    );
  });
}
