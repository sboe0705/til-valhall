import type { RemoteFile } from './sync';

/**
 * The few Drive v3 calls the sync needs, against the hidden `appDataFolder`.
 *
 * That folder is private to this OAuth client: the user cannot browse it and
 * the app cannot see anything else in the Drive – which is why the narrow
 * `drive.appdata` scope is all the login asks for.
 *
 * Token and `fetch` are injected, so the requests are testable without a
 * network and nothing here reaches for a global.
 */

/* --- endpoints --- */

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const SYNC_FILENAME = 'til-valhall.json';

/**
 * `keepalive` requests share a 64 KiB budget; a larger body would be refused
 * outright, so beyond this it falls back to a plain request.
 */
const KEEPALIVE_LIMIT = 60_000;

/* --- errors --- */

/** 401 – the token expired or was revoked. The caller pauses instead of retrying. */
export class DriveAuthError extends Error {
  constructor() {
    super('drive: unauthorized');
  }
}

export class DriveError extends Error {
  constructor(readonly status: number) {
    super(`drive: HTTP ${status}`);
  }
}

/* --- client --- */

export interface DriveClient {
  /** The sync file, or `null` before the first upload. Oldest wins if two exist. */
  find(): Promise<RemoteFile | null>;
  download(id: string): Promise<string>;
  create(body: string): Promise<RemoteFile>;
  update(id: string, body: string): Promise<RemoteFile>;
  fetchEmail(): Promise<string>;
}

export interface DriveOptions {
  fetch?: typeof fetch;
  /** Let uploads outlive the page – used for the flush when the app is hidden. */
  keepalive?: boolean;
}

export function createDriveClient(
  token: string,
  options: DriveOptions = {},
): DriveClient {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const keepalive = options.keepalive ?? false;

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const res = await fetchFn(url, { ...init, headers });
    if (res.status === 401) throw new DriveAuthError();
    if (!res.ok) throw new DriveError(res.status);
    return res;
  }

  const upload = (url: string, init: RequestInit, size: number) =>
    request(url, { ...init, keepalive: keepalive && size < KEEPALIVE_LIMIT });

  return {
    async find() {
      const params = new URLSearchParams({
        spaces: 'appDataFolder',
        q: `name = '${SYNC_FILENAME}' and trashed = false`,
        fields: 'files(id,version)',
        orderBy: 'createdTime',
      });
      const res = await request(`${FILES}?${params}`);
      const { files } = (await res.json()) as { files?: RemoteFile[] };
      return files?.[0] ?? null;
    },

    async download(id) {
      const res = await request(`${FILES}/${encodeURIComponent(id)}?alt=media`);
      return res.text();
    },

    async create(body) {
      const boundary = `til-valhall-${Math.random().toString(36).slice(2)}`;
      const metadata = JSON.stringify({
        name: SYNC_FILENAME,
        parents: ['appDataFolder'],
      });
      const multipart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
        `--${boundary}--`;
      const res = await upload(
        `${UPLOAD}?uploadType=multipart&fields=id,version`,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipart,
        },
        multipart.length,
      );
      return (await res.json()) as RemoteFile;
    },

    async update(id, body) {
      const res = await upload(
        `${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id,version`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body },
        body.length,
      );
      return (await res.json()) as RemoteFile;
    },

    async fetchEmail() {
      const res = await request(USERINFO);
      const { email } = (await res.json()) as { email?: string };
      if (!email) throw new DriveError(res.status);
      return email;
    },
  };
}
