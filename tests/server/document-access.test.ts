import { describe, expect, it } from 'vitest';

import { decideDocumentAccess } from '@/lib/persistence/document-access';
import type { StageMetaRow } from '@/lib/persistence/stage-meta';

const meta = (over: Partial<StageMetaRow> = {}): StageMetaRow => ({
  stageId: 's1',
  ownerId: 'user:a',
  isPublic: false,
  publishedAt: null,
  generationComplete: true,
  deletedAt: null,
  ...over,
});

const read = (row: StageMetaRow | null, ownerId: string) =>
  decideDocumentAccess(
    { kind: 'read', stageId: 's1' },
    ownerId,
    async () => row,
    async () => true,
  );

describe('document read access', () => {
  it('lets the owner read a private course', async () => {
    expect(await read(meta(), 'user:a')).toBe('allow');
  });

  it('hides a private course from other users as not-found', async () => {
    expect(await read(meta(), 'user:b')).toBe('not-found');
  });

  it('lets any signed-in user read a public course', async () => {
    expect(await read(meta({ isPublic: true, publishedAt: 1 }), 'user:b')).toBe('allow');
  });

  it('treats a deleted course as not-found, even when public', async () => {
    expect(await read(meta({ isPublic: true, deletedAt: new Date() }), 'user:b')).toBe(
      'not-found',
    );
    expect(await read(meta({ deletedAt: new Date() }), 'user:a')).toBe('not-found');
  });

  it('still forbids writes by non-owners of a public course', async () => {
    const access = await decideDocumentAccess(
      { kind: 'write', stageId: 's1' },
      'user:b',
      async () => meta({ isPublic: true }),
      async () => true,
    );
    expect(access).toBe('forbid');
  });
});
