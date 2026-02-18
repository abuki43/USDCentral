import Constants from 'expo-constants';

import { firebaseAuth } from '@/lib/firebase';
import { buildBackendError } from '@/lib/errors';

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
      const parsed = buildBackendError(text, res.status);
      if (parsed) throw parsed;
      throw new Error(text);
    }
    throw new Error(`Request failed (${res.status})`);
  }

  return res.json();
}
