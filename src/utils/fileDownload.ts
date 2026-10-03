import { Directory, File, Paths } from 'expo-file-system';

// STATUS: REAL, NEW TONIGHT. Uses expo-file-system — the current
// SDK 57 object-oriented API, confirmed against Expo's own docs before
// writing this rather than assumed from memory (a lesson learned the
// hard way earlier tonight with a package that was used in code but
// never actually installed). Directory.list() and File instances are
// both confirmed real, documented behavior, not guessed.
//
// Deliberate scope decision: files save to this app's own private
// storage (Paths.document), NOT the device's shared Downloads folder
// or photo gallery. "Downloaded" here means "saved for offline
// viewing inside UniLink," not "shows up in your phone's file
// browser." Getting a file into shared storage needs a second library
// (expo-media-library, scoped to photos/videos, not arbitrary
// documents) or the Storage Access Framework — a materially bigger,
// riskier scope than justified for one night's work. This is a real,
// complete feature at the scope it claims.
//
// Filenames are sanitized to plain alphanumerics/dashes/underscores
// only — no spaces, no punctuation. This isn't just tidiness: a real,
// currently open Expo GitHub issue documents Directory.list() and the
// File constructor throwing on paths containing spaces, '#', or '%'.
// A naive "Week 3 Notes.pdf" would download fine today and then break
// the downloads LIST screen later. Spaces become underscores instead
// of being stripped, so filenames stay readable.
//
// This is a new native dependency (expo-file-system) as of tonight —
// needs `npx expo install expo-file-system` and a fresh EAS build,
// will not apply via OTA alone.

const DOWNLOADS_DIR_NAME = 'unilink_downloads';

export interface DownloadedFileInfo {
  uri: string;
  name: string;
  size: number;
}

function getDownloadsDirectory(): Directory {
  const dir = new Directory(Paths.document, DOWNLOADS_DIR_NAME);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function buildFileName(title: string, sourceUrl: string): string {
  const urlExtMatch = sourceUrl.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  const ext = urlExtMatch ? urlExtMatch[1].toLowerCase() : 'bin';
  const safeTitle = title
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 60);
  return `${safeTitle || 'download'}.${ext}`;
}

export function getExistingDownload(title: string, sourceUrl: string): DownloadedFileInfo | null {
  const fileName = buildFileName(title, sourceUrl);
  const file = new File(getDownloadsDirectory(), fileName);
  return file.exists ? { uri: file.uri, name: fileName, size: file.size ?? 0 } : null;
}

export async function downloadFile(title: string, sourceUrl: string): Promise<DownloadedFileInfo> {
  const fileName = buildFileName(title, sourceUrl);
  const dir = getDownloadsDirectory();

  const existing = new File(dir, fileName);
  if (existing.exists) {
    return { uri: existing.uri, name: fileName, size: existing.size ?? 0 };
  }

  // downloadFileAsync names the saved file from the URL's own last
  // path segment (usually an opaque Cloudinary hash), not our chosen
  // title-based name — so the file is downloaded first, then given
  // the real name via delete+recreate, using File's own read/write
  // rather than assuming a rename() method exists (not confirmed in
  // the docs actually read).
  const downloaded = await File.downloadFileAsync(sourceUrl, dir);
  if (downloaded.uri === existing.uri) {
    return { uri: downloaded.uri, name: fileName, size: downloaded.size ?? 0 };
  }

  // bytes() is Promise-wrapped as of SDK 54 (confirmed via Expo's own
  // GitHub issue tracker — it was synchronous in SDK 53, a real
  // breaking change easy to miss) — must be awaited, not called
  // synchronously.
  const bytes = await downloaded.bytes();
  existing.create();
  existing.write(bytes);
  downloaded.delete();

  return { uri: existing.uri, name: fileName, size: existing.size ?? 0 };
}

export function listDownloadedFiles(): DownloadedFileInfo[] {
  const dir = getDownloadsDirectory();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((f) => ({ uri: f.uri, name: f.name, size: f.size ?? 0 }));
}

export function deleteDownloadedFile(name: string): void {
  const file = new File(getDownloadsDirectory(), name);
  if (file.exists) file.delete();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
