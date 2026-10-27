import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppBackupSnapshot, storage } from './storage';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const BACKUP_FILE_NAME = 'busy_bees_expense_tracker_backup.json';

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
];

function createGoogleProvider(selectAccount = false) {
  const provider = new GoogleAuthProvider();
  for (const scope of DRIVE_SCOPES) {
    provider.addScope(scope);
  }
  if (selectAccount) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return provider;
}

// Strictly in-memory token cache (never persisted to localStorage or sessionStorage)
let cachedToken: string | null = null;
let tokenExpiry = 0;

export function hasActiveAccessToken(): boolean {
  return Boolean(cachedToken && Date.now() < tokenExpiry);
}

export function invalidateAccessToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

export async function connectGoogleAccount(selectAccount = false): Promise<{
  user: User;
  accessToken: string;
}> {
  const provider = createGoogleProvider(selectAccount);
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;

  if (!token) {
    throw new Error('Google Drive permission was not granted. Please try again and allow Drive access.');
  }

  cachedToken = token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutes

  if (result.user.email) {
    storage.saveBackupMeta({ googleEmail: result.user.email });
  }

  return { user: result.user, accessToken: token };
}

export async function getAccessToken(selectAccount = false): Promise<string> {
  if (!selectAccount && cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  const { accessToken } = await connectGoogleAccount(selectAccount);
  return accessToken;
}

export async function disconnectGoogleAccount(): Promise<void> {
  invalidateAccessToken();
  await firebaseSignOut(auth);
  storage.saveBackupMeta({ googleEmail: '' });
}

export function subscribeAuthUser(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      invalidateAccessToken();
    } else if (user.email) {
      storage.saveBackupMeta({ googleEmail: user.email });
    }
    callback(user);
  });
}

export interface CloudBackupFileInfo {
  id: string;
  name: string;
  modifiedTime: string;
  sizeBytes: number;
  txCount?: number;
  profileName?: string;
  currency?: string;
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    invalidateAccessToken();
    throw new Error('AUTH_EXPIRED');
  }

  return response;
}

/**
 * Searches Google Drive (appDataFolder first, then user Drive files created by this app)
 * for the latest Busy Bees backup file.
 */
export async function findCloudBackup(token: string): Promise<CloudBackupFileInfo | null> {
  const query = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and trashed = false`);
  const fields = encodeURIComponent('files(id, name, modifiedTime, size, appProperties)');

  // Check appDataFolder first (WhatsApp-style hidden app data container)
  const appDataUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=5`;
  const res = await driveFetch(appDataUrl, token);

  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data.files) && data.files.length > 0) {
      const f = data.files[0];
      return {
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        sizeBytes: Number(f.size || 0),
        txCount: f.appProperties?.txCount ? Number(f.appProperties.txCount) : undefined,
        profileName: f.appProperties?.profileName || undefined,
        currency: f.appProperties?.currency || undefined,
      };
    }
  }

  // Fallback check in drive space (for files created with drive.file scope)
  const driveUrl = `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=5`;
  const driveRes = await driveFetch(driveUrl, token);
  if (driveRes.ok) {
    const driveData = await driveRes.json();
    if (Array.isArray(driveData.files) && driveData.files.length > 0) {
      const f = driveData.files[0];
      return {
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        sizeBytes: Number(f.size || 0),
        txCount: f.appProperties?.txCount ? Number(f.appProperties.txCount) : undefined,
        profileName: f.appProperties?.profileName || undefined,
        currency: f.appProperties?.currency || undefined,
      };
    }
  }

  return null;
}

/**
 * Uploads or overwrites the Busy Bees backup snapshot in Google Drive.
 */
export async function uploadCloudBackup(
  token: string,
  snapshot: AppBackupSnapshot,
  existingFileId?: string
): Promise<CloudBackupFileInfo> {
  const jsonContent = JSON.stringify(snapshot, null, 2);
  const contentBytes = new TextEncoder().encode(jsonContent).length;

  const metadata: Record<string, unknown> = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
    appProperties: {
      app: 'busy-bees-expense-tracker',
      txCount: String(snapshot.transactions.length),
      profileName: snapshot.profile.name || '',
      currency: snapshot.settings.currency || 'INR',
    },
  };

  if (!existingFileId) {
    metadata.parents = ['appDataFolder'];
  }

  const boundary = 'busy_bees_backup_boundary_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  const uploadUrl = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime,size,appProperties`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,appProperties`;

  const method = existingFileId ? 'PATCH' : 'POST';

  const res = await driveFetch(uploadUrl, token, {
    method,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to upload backup to Google Drive (${res.status}). ${errText}`);
  }

  const fileData = await res.json();
  const sizeBytes = Number(fileData.size || contentBytes);
  const modifiedTime = fileData.modifiedTime || new Date().toISOString();

  storage.saveBackupMeta({
    lastBackupTime: new Date(modifiedTime).getTime(),
    lastBackupSize: sizeBytes,
    lastBackupTxCount: snapshot.transactions.length,
    googleEmail: auth.currentUser?.email || storage.getBackupMeta().googleEmail,
  });

  return {
    id: fileData.id,
    name: fileData.name || BACKUP_FILE_NAME,
    modifiedTime,
    sizeBytes,
    txCount: snapshot.transactions.length,
    profileName: snapshot.profile.name || undefined,
    currency: snapshot.settings.currency,
  };
}

/**
 * Downloads the backup JSON from Google Drive and parses it.
 */
export async function downloadCloudBackup(
  token: string,
  fileId: string
): Promise<AppBackupSnapshot> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await driveFetch(url, token);

  if (!res.ok) {
    throw new Error(`Failed to download backup from Google Drive (${res.status}).`);
  }

  const parsed = (await res.json()) as AppBackupSnapshot;
  if (!parsed || !Array.isArray(parsed.transactions)) {
    throw new Error('The backup file on Google Drive is invalid or corrupted.');
  }

  return parsed;
}

/**
 * Deletes the backup file from Google Drive.
 */
export async function deleteCloudBackup(token: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await driveFetch(url, token, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete backup from Google Drive (${res.status}).`);
  }
  storage.saveBackupMeta({
    lastBackupTime: null,
    lastBackupSize: null,
    lastBackupTxCount: null,
  });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatBackupTimestamp(timestamp: number | string | null | undefined): string {
  if (!timestamp) return 'Never';
  const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(d.getTime())) return 'Never';

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today, ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${dateStr}, ${timeStr}`;
}
