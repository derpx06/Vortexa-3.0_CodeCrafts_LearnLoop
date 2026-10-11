/**
 * Generated study sets (flashcards + quiz), one per course.
 *
 * Shared by every viewer of the course: a public course's study set is
 * generated once and reused, not once per visitor. The row goes with the
 * course (`ON DELETE CASCADE`).
 */
import type { Queryable } from '@openmaic/storage/document/pg';
import { applySchemaMigrations, type SchemaMigrationSet } from '@openmaic/storage/pg-migrations';

import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import type { StudySet } from '@/lib/study-set/types';

export const STUDY_SET_MIGRATIONS: SchemaMigrationSet = {
  store: 'study_sets',
  migrations: [
    {
      version: 1,
      name: 'baseline',
      up: `CREATE TABLE IF NOT EXISTS course_study_sets (
        stage_id TEXT PRIMARY KEY REFERENCES document_stages(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      transaction: false,
    },
  ],
};

let schemaReady: Promise<void> | undefined;

async function pool() {
  const provider = await getServerPersistenceProvider(process.env.DATABASE_URL ?? '');
  schemaReady ??= applySchemaMigrations(provider.pool as unknown as Queryable, STUDY_SET_MIGRATIONS)
    .then(() => undefined)
    .catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  await schemaReady;
  return provider.pool;
}

export async function readStudySet(stageId: string): Promise<StudySet | null> {
  const db = await pool();
  const { rows } = await db.query<{ data: StudySet }>(
    'SELECT data FROM course_study_sets WHERE stage_id = $1',
    [stageId],
  );
  return rows[0]?.data ?? null;
}

export async function writeStudySet(stageId: string, set: StudySet): Promise<void> {
  const db = await pool();
  await db.query(
    `INSERT INTO course_study_sets (stage_id, data) VALUES ($1, $2)
     ON CONFLICT (stage_id) DO UPDATE SET data = EXCLUDED.data, created_at = now()`,
    [stageId, JSON.stringify(set)],
  );
}

export interface CourseSceneRow {
  type: string;
  title: string;
  data: Record<string, unknown>;
}

/** The course's scenes in playback order. */
export async function readCourseScenes(stageId: string): Promise<CourseSceneRow[]> {
  const db = await pool();
  const { rows } = await db.query<{ data: Record<string, unknown> }>(
    'SELECT data FROM document_scenes WHERE stage_id = $1 ORDER BY scene_order, id',
    [stageId],
  );
  return rows.map((row) => ({
    type: String(row.data.type ?? ''),
    title: String(row.data.title ?? ''),
    data: row.data,
  }));
}

export async function readCourseDescription(stageId: string): Promise<string | undefined> {
  const db = await pool();
  const { rows } = await db.query<{ description: string | null }>(
    'SELECT description FROM document_stages WHERE id = $1',
    [stageId],
  );
  return rows[0]?.description ?? undefined;
}
