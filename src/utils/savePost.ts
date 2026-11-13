import { Linking } from 'react-native';
import { downloadFile } from './fileDownload';

// STATUS: REAL. "Save" on a post. Every photo, video or document in the post is downloaded into the app, then the
// phone's own share sheet opens so the person can put it in Files, Downloads or the gallery (expo-sharing).
//
// If the share sheet is not available (an older build without expo-sharing, or a phone that refuses), the file is
// opened in the browser instead, which downloads it. Nothing here can crash the screen: the share module is only
// loaded when someone taps Save, and every step is guarded.

export interface SavableMedia {
  url: string;
  type: 'image' | 'video' | 'document';
  originalName?: string | null;
}

export interface SaveResult {
  saved: number;
  failed: number;
  how: 'share' | 'browser' | 'none';
}

async function shareFile(uri: string): Promise<boolean> {
  try {
    // Loaded here, not at the top of the file, so a build without the native module cannot fail at startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri);
    return true;
  } catch {
    return false;
  }
}

// A readable name for the saved file, without the extension (downloadFile takes it from the link).
export function saveName(authorName: string | undefined, media: SavableMedia, index: number, total: number): string {
  const own = media.type === 'document' && media.originalName ? media.originalName.replace(/\.[^.]+$/, '') : '';
  const base = own || `${authorName || 'UniLink'} post`;
  return total > 1 && !own ? `${base} ${index + 1}` : base;
}

export async function savePostMedia(authorName: string | undefined, media: SavableMedia[]): Promise<SaveResult> {
  const files = [];
  let failed = 0;
  for (let i = 0; i < media.length; i += 1) {
    try {
      files.push(await downloadFile(saveName(authorName, media[i], i, media.length), media[i].url));
    } catch {
      failed += 1;
    }
  }
  if (files.length === 0) return { saved: 0, failed, how: 'none' };

  // The share sheet takes one file at a time, so a post with several attachments opens it once per file.
  // If the very first one cannot open, fall through to the browser below.
  if (await shareFile(files[0].uri)) {
    for (const file of files.slice(1)) await shareFile(file.uri);
    return { saved: files.length, failed, how: 'share' };
  }

  try {
    await Linking.openURL(media[0].url);
    return { saved: files.length, failed, how: 'browser' };
  } catch {
    return { saved: files.length, failed, how: 'none' };
  }
}
