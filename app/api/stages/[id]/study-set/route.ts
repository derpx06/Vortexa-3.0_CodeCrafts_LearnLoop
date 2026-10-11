/**
 * GET  /api/stages/[id]/study-set — the course's flashcards and quiz,
 *      generated on first request and stored for every later viewer.
 * POST /api/stages/[id]/study-set — regenerate them (owner only).
 *
 * Readable by the owner, and by anyone when the course is public.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isServerPersistenceConfigured } from '@/lib/config/feature-flags';
import { createLogger } from '@/lib/logger';
import { withRequestOwner } from '@/lib/server/identity/with-owner';
import { resolveStageAccess, type StageAccess } from '@/lib/server/stage-access';
import { courseTranscript, generateStudySet } from '@/lib/server/study-set/generate';
import {
  readCourseDescription,
  readCourseScenes,
  readStudySet,
  writeStudySet,
} from '@/lib/server/study-set/store';
import type { StudySet } from '@/lib/study-set/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Generation is one LLM call, but a slow model can take a while.
export const maxDuration = 120;

const log = createLogger('StudySet');

type Params = { params: Promise<{ id: string }> };

/** One generation per course at a time: concurrent first opens share it. */
const inFlight = new Map<string, Promise<StudySet>>();

function generateOnce(req: NextRequest, access: StageAccess): Promise<StudySet> {
  const existing = inFlight.get(access.stageId);
  if (existing) return existing;
  const job = (async () => {
    const [scenes, description] = await Promise.all([
      readCourseScenes(access.stageId),
      readCourseDescription(access.stageId),
    ]);
    if (scenes.length === 0) throw new Error('course has no scenes');
    const set = await generateStudySet(req, courseTranscript(access.name, description, scenes));
    await writeStudySet(access.stageId, set);
    return set;
  })().finally(() => inFlight.delete(access.stageId));
  inFlight.set(access.stageId, job);
  return job;
}

async function handle(req: NextRequest, { params }: Params, regenerate: boolean) {
  if (!isServerPersistenceConfigured()) return new Response('Not found', { status: 404 });

  return withRequestOwner(req, async ({ ownerId }, responseHeaders) => {
    const { id: stageId } = await params;
    responseHeaders.set('Cache-Control', 'no-store');
    try {
      const access = await resolveStageAccess(stageId);
      const isOwner = access?.ownerId === ownerId;
      if (!access || (!isOwner && !access.isPublic)) {
        return NextResponse.json({ error: 'not_found' }, { status: 404, headers: responseHeaders });
      }
      if (regenerate && !isOwner) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: responseHeaders });
      }

      const cached = regenerate ? null : await readStudySet(stageId);
      const set = cached ?? (await generateOnce(req, access));
      return NextResponse.json(set, { headers: responseHeaders });
    } catch (error) {
      log.error('Failed to get study set', {
        stageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'generation_failed' },
        { status: 500, headers: responseHeaders },
      );
    }
  });
}

export function GET(req: NextRequest, ctx: Params) {
  return handle(req, ctx, false);
}

export function POST(req: NextRequest, ctx: Params) {
  return handle(req, ctx, true);
}
