/**
 * GET /api/stages/[id]/overview — what the course hub shows before the learner
 * picks slides, flashcards or quiz. Readable by the owner, and by anyone when
 * the course is public; otherwise 404, like a course that does not exist.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isServerPersistenceConfigured } from '@/lib/config/feature-flags';
import { withRequestOwner } from '@/lib/server/identity/with-owner';
import { resolveStageAccess } from '@/lib/server/stage-access';
import {
  readCourseDescription,
  readCourseScenes,
  readStudySet,
} from '@/lib/server/study-set/store';
import type { CourseOverview } from '@/lib/study-set/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

      const [scenes, description, studySet] = await Promise.all([
        readCourseScenes(stageId),
        readCourseDescription(stageId),
        readStudySet(stageId),
      ]);
      const overview: CourseOverview = {
        id: stageId,
        name: access.name,
        description,
        isOwner,
        slideCount: scenes.filter((s) => s.type === 'slide').length,
        sceneCount: scenes.length,
        firstSceneId: scenes[0] ? String(scenes[0].data.id) : undefined,
        hasStudySet: studySet !== null,
      };
      return NextResponse.json(overview, { headers: responseHeaders });
    } catch (error) {
      console.error('Failed to read course overview', {
        stageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'internal_error' },
        { status: 500, headers: responseHeaders },
      );
    }
  });
}
