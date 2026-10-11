/**
 * GET /api/stages/[id]/slides — the course's slide canvases in playback order,
 * for the slide deck viewer (slides only, no narration or AI teachers).
 * Readable by the owner, and by anyone when the course is public.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isServerPersistenceConfigured } from '@/lib/config/feature-flags';
import { withRequestOwner } from '@/lib/server/identity/with-owner';
import { resolveStageAccess } from '@/lib/server/stage-access';
import { readCourseScenes } from '@/lib/server/study-set/store';
import type { CourseSlide } from '@/lib/study-set/types';

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
      if (!access || (access.ownerId !== ownerId && !access.isPublic)) {
        return NextResponse.json({ error: 'not_found' }, { status: 404, headers: responseHeaders });
      }

      const slides: CourseSlide[] = [];
      for (const scene of await readCourseScenes(stageId)) {
        const content = scene.data.content as Record<string, unknown> | undefined;
        const canvas = content?.canvas as Record<string, unknown> | undefined;
        if (scene.type !== 'slide' || !canvas) continue;
        slides.push({ sceneId: String(scene.data.id), title: scene.title, canvas });
      }
      return NextResponse.json(slides, { headers: responseHeaders });
    } catch (error) {
      console.error('Failed to read course slides', {
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
