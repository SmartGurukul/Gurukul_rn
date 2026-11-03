/**
 * Web stand-in for the parts of expo-file-system's `File`/`Paths` API the app uses: downloading a
 * server file (PDFs, CSV exports), reading a picked file's text/size, and uploading a picked file to
 * a presigned URL. A "file" is a blob: URL plus the name it should be saved under, so the
 * expo-sharing stand-in (./sharing) can hand it to the browser as a download.
 * Wired in for web builds only, by metro.config.js.
 */

/** blob/data URI -> the file name it should be saved as, and its size when known. */
const registry = new Map<string, { name: string; size: number }>();

export function savedFileName(uri: string): string | undefined {
  return registry.get(uri)?.name;
}

class WebDirectory {
  constructor(public uri: string) {}
}

export const Paths = {
  cache: new WebDirectory('cache:'),
  document: new WebDirectory('document:'),
};

export class File {
  uri: string;
  name: string;

  constructor(dirOrUri: WebDirectory | File | string, name?: string) {
    if (name !== undefined) {
      this.uri = '';
      this.name = name;
    } else {
      this.uri = typeof dirOrUri === 'string' ? dirOrUri : dirOrUri.uri;
      this.name = registry.get(this.uri)?.name ?? this.uri.split('/').pop() ?? 'file';
    }
  }

  /** 0 when unknown, which every caller treats as "use the size the picker reported". */
  get size(): number {
    return registry.get(this.uri)?.size ?? 0;
  }

  get exists(): boolean {
    return !!this.uri;
  }

  private async blob(): Promise<Blob> {
    const res = await fetch(this.uri);
    return res.blob();
  }

  async text(): Promise<string> {
    return (await this.blob()).text();
  }

  async upload(url: string, options: { httpMethod?: string; headers?: Record<string, string> } = {}) {
    const res = await fetch(url, { method: options.httpMethod ?? 'POST', headers: options.headers, body: await this.blob() });
    return { status: res.status, body: await res.text(), headers: Object.fromEntries(res.headers.entries()) };
  }

  async move(destination: File) {
    const entry = registry.get(this.uri);
    registry.set(this.uri, { name: destination.name, size: entry?.size ?? 0 });
    destination.uri = this.uri;
    this.name = destination.name;
  }

  /** Like the native one, rejects on a non-2xx response so an error body is never saved as the file. */
  static async downloadFileAsync(
    url: string,
    destination: File,
    options: { headers?: Record<string, string>; idempotent?: boolean } = {}
  ): Promise<File> {
    const res = await fetch(url, { headers: options.headers });
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.message ? `: ${body.message}` : '';
      } catch {
        // not JSON - keep the status alone
      }
      throw new Error(`Download failed (HTTP ${res.status})${detail}`);
    }
    const blob = await res.blob();
    const uri = URL.createObjectURL(blob);
    registry.set(uri, { name: destination.name, size: blob.size });
    destination.uri = uri;
    return destination;
  }
}

/** Registers a URI (e.g. from expo-print's web output) under a file name for ./sharing to use. */
export function registerWebFile(uri: string, name: string, size = 0) {
  registry.set(uri, { name, size });
}
