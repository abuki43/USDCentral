import Constants from 'expo-constants';

import { firebaseAuth } from '@/lib/firebase';

const backendUrl =
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) ??
  'http://192.168.3.235:3000';

console.log('Backend URL:', backendUrl);
export async function backendFetch(path: string, init: RequestInit = {}) {
  const user = firebaseAuth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const baseUrl = backendUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const res = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (text) {
      const parseJson = (raw: string) => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };

      let data = parseJson(text);
      if (typeof data === 'string') {
        data = parseJson(data);
      }

      if (!data) {
        const trimmed = text.trim();
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start !== -1 && end > start) {
          data = parseJson(trimmed.slice(start, end + 1));
          if (typeof data === 'string') {
            data = parseJson(data);
          }
        }
      }

      if (data && typeof data === 'object') {
        const message =
          (data as { message?: string })?.message || `Request failed (${res.status})`;
        const error = new Error(message) as Error & {
          code?: string;
          details?: unknown;
        };
        const code = (data as { code?: string })?.code;
        const details = (data as { details?: unknown })?.details;
        if (code) error.code = code;
        if (details) error.details = details;
        throw error;
      }

      throw new Error(text);
    }
    throw new Error(`Request failed (${res.status})`);
  }

  return res.json();
}
