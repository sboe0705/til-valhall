import { describe, expect, it } from 'vitest';

import { DriveAuthError, DriveError, SYNC_FILENAME, createDriveClient } from './drive';

interface Call {
  url: string;
  init: RequestInit;
}

/** A `fetch` that records every call and answers with the queued responses. */
function fakeFetch(...responses: Response[]) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return responses.shift() ?? new Response(null, { status: 500 });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

const auth = (call: Call) => new Headers(call.init.headers).get('Authorization');

describe('drive client', () => {
  it('lists the sync file in the app folder with the bearer token', async () => {
    const { fetch, calls } = fakeFetch(json({ files: [{ id: 'f-1', version: '9' }] }));
    const file = await createDriveClient('tok', { fetch }).find();

    expect(file).toEqual({ id: 'f-1', version: '9' });
    const url = new URL(calls[0].url);
    expect(url.searchParams.get('spaces')).toBe('appDataFolder');
    expect(url.searchParams.get('q')).toContain(`name = '${SYNC_FILENAME}'`);
    expect(auth(calls[0])).toBe('Bearer tok');
  });

  it('reports a missing file as null', async () => {
    const { fetch } = fakeFetch(json({ files: [] }));
    expect(await createDriveClient('tok', { fetch }).find()).toBeNull();
  });

  it('creates the file in appDataFolder as a multipart upload', async () => {
    const { fetch, calls } = fakeFetch(json({ id: 'f-2', version: '1' }));
    const file = await createDriveClient('tok', { fetch }).create(
      '{"app":"til-valhall"}',
    );

    expect(file).toEqual({ id: 'f-2', version: '1' });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].url).toContain('uploadType=multipart');
    const type = new Headers(calls[0].init.headers).get('Content-Type')!;
    const boundary = type.match(/boundary=(.+)$/)![1];
    const body = calls[0].init.body as string;
    expect(body).toContain('"parents":["appDataFolder"]');
    expect(body).toContain('{"app":"til-valhall"}');
    expect(body.endsWith(`--${boundary}--`)).toBe(true);
  });

  it('updates the content in place and only keeps small uploads alive', async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: 'f-1', version: '10' }),
      json({ id: 'f-1', version: '11' }),
    );
    const drive = createDriveClient('tok', { fetch, keepalive: true });

    expect(await drive.update('f-1', '{}')).toEqual({ id: 'f-1', version: '10' });
    expect(calls[0].init.method).toBe('PATCH');
    expect(calls[0].url).toContain('/upload/drive/v3/files/f-1?uploadType=media');
    expect(calls[0].init.keepalive).toBe(true);

    await drive.update('f-1', 'x'.repeat(70_000));
    expect(calls[1].init.keepalive).toBe(false);
  });

  it('downloads the content and reads the account address', async () => {
    const { fetch, calls } = fakeFetch(
      new Response('{"app":"til-valhall"}'),
      json({ email: 'odin@example.com' }),
    );
    const drive = createDriveClient('tok', { fetch });

    expect(await drive.download('f-1')).toBe('{"app":"til-valhall"}');
    expect(calls[0].url).toContain('/files/f-1?alt=media');
    expect(await drive.fetchEmail()).toBe('odin@example.com');
  });

  it('tells an expired token apart from other failures', async () => {
    const { fetch } = fakeFetch(json({}, 401), json({}, 503));
    const drive = createDriveClient('tok', { fetch });

    await expect(drive.find()).rejects.toBeInstanceOf(DriveAuthError);
    await expect(drive.find()).rejects.toBeInstanceOf(DriveError);
  });
});
