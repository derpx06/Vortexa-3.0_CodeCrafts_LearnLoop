/**
 * GET /api/stages/public — courses other users have published, newest first.
 *
 * Returns the author's display name only (never an email or owner id), in
 * keeping with `GET /api/stage-meta/[stageId]`, which deliberately does not
 * let a visitor identify an author across courses by id. The caller's own
 * public courses are left out: they already appear in their library.
 */
import { NextResponse } from 'next/server';

import { isServerPersistenceConfigured } from '@/lib/config/feature-flags';
import { ensureAuthSchema } from '@/lib/server/auth/store';
import { withRequestOwner } from '@/lib/server/identity/with-owner';
import { getStageAccessDb } from '@/lib/server/stage-access';

export const runtime = 'nodejs';

const PUBLIC_LIMIT = 60;

interface PublicRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
  author_name: string | null;
  scene_count: string | number;
}

export async function GET(req: Request) {
  if (!isServerPersistenceConfigured()) return NextResponse.json({ courses: [] });

  return withRequestOwner(req, async (principal, responseHeaders) => {
    responseHeaders.set('Cache-Control', 'no-store');
    // The join reads `auth_users`; make sure it exists on a fresh database.
    await ensureAuthSchema();
    const db = await getStageAccessDb();
    const { rows } = await db.query<PublicRow>(
      `SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
              m.published_at, u.name AS author_name,
              (SELECT count(*) FROM document_scenes sc WHERE sc.stage_id = s.id) AS scene_count
         FROM stage_meta m
         JOIN document_stages s ON s.id = m.stage_id
         LEFT JOIN auth_users u ON 'user:' || u.id::text = m.created_by
        WHERE m.is_public AND m.deleted_at IS NULL AND m.owner_id <> $1
        ORDER BY m.published_at DESC NULLS LAST
        LIMIT ${PUBLIC_LIMIT}`,
      [principal.ownerId],
    );
    return NextResponse.json(
      {
        courses: rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
          sceneCount: Number(row.scene_count),
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
          publishedAt: row.published_at === null ? null : Number(row.published_at),
          authorName: row.author_name,
        })),
      },
      { headers: responseHeaders },
    );
  });
}
