import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import rawFirebaseConfig from '../../firebase-applet-config.json';
import { AppBackupSnapshot, storage } from './storage';

interface NativeDriveBridge {
  isNativeDriveSupported?: () => boolean;
  getConnectedGoogleEmail?: () => string;
  disconnectGoogleAccount?: () => void;
  connectGoogleAccount?: () => void;
  saveBackupToGoogleDrive?: (
    jsonContent: string,
    fileName: string,
    interactiveSaveToDrive: boolean
  ) => void;
  getCachedBackupMetadataJson?: () => string;
  getCachedBackupContent?: () => string;
  scanCloudBackupInBackground?: () => void;
  openGoogleDriveRestorePicker?: () => void;
  deleteCachedBackup?: () => void;
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: GisTokenResponse) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => GisTokenClient;
        };
      };
    };
  }
}

function getNativeDriveBridge(): NativeDriveBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { BusyBeesNative?: NativeDriveBridge };
  if (
    win.BusyBeesNative &&
    typeof win.BusyBeesNative.isNativeDriveSupported === 'function' &&
    win.BusyBeesNative.isNativeDriveSupported()
  ) {
    return win.BusyBeesNative;
  }
  return null;
}

export function isNativeDriveBridgeAvailable(): boolean {
  return Boolean(getNativeDriveBridge());
}

const resolvedFirebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || rawFirebaseConfig.projectId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || rawFirebaseConfig.appId || '',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || rawFirebaseConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || rawFirebaseConfig.authDomain || '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || rawFirebaseConfig.storageBucket || '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawFirebaseConfig.messagingSenderId || '',
  measurementId: rawFirebaseConfig.measurementId || '',
  oAuthClientId:
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    (rawFirebaseConfig as { oAuthClientId?: string }).oAuthClientId ||
    '',
};

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;

function getFirebaseAuth(): Auth | null {
  if (firebaseAuthInstance) return firebaseAuthInstance;
  if (!resolvedFirebaseConfig.apiKey) {
    return null;
  }
  try {
    firebaseAppInstance = getApps().length ? getApp() : initializeApp(resolvedFirebaseConfig);
    firebaseAuthInstance = getAuth(firebaseAppInstance);
    return firebaseAuthInstance;
  } catch (err) {
    console.warn('Firebase Auth initialization skipped:', err);
    return null;
  }
}

export const BACKUP_FILE_NAME = 'busy_bees_expense_tracker_backup.json';

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
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

// Strictly in-memory token & user cache (never persisted to localStorage or sessionStorage)
let cachedToken: string | null = null;
let tokenExpiry = 0;
let currentConnectedUser: User | null = null;
const authListeners = new Set<(user: User | null) => void>();

function notifyAuthListeners(user: User | null) {
  currentConnectedUser = user;
  for (const listener of authListeners) {
    try {
      listener(user);
    } catch {
      // ignore
    }
  }
}

function createSyntheticUser(email: string): User {
  return {
    email,
    uid: `google_${email}`,
    displayName: email.split('@')[0] || email,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as never),
    reload: async () => {},
    toJSON: () => ({ email }),
    phoneNumber: null,
    photoURL: null,
    providerId: 'google.com',
  } as unknown as User;
}

export function hasActiveAccessToken(): boolean {
  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge) {
    const email = nativeBridge.getConnectedGoogleEmail?.() || storage.getBackupMeta().googleEmail;
    return Boolean(email);
  }
  return Boolean(cachedToken && Date.now() < tokenExpiry);
}

export function invalidateAccessToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

let gisScriptPromise: Promise<void> | null = null;

function ensureGisLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window unavailable'));
  if (window.google?.accounts?.oauth2?.initTokenClient) {
    return Promise.resolve();
  }
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.email) return String(data.email);
    }
  } catch {
    // ignore
  }
  try {
    const driveAbout = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (driveAbout.ok) {
      const data = await driveAbout.json();
      if (data?.user?.emailAddress) return String(data.user.emailAddress);
    }
  } catch {
    // ignore
  }
  return storage.getBackupMeta().googleEmail || 'Connected Google Account';
}

async function connectViaGoogleIdentityServices(selectAccount = false): Promise<{
  user: User;
  accessToken: string;
}> {
  const clientId = resolvedFirebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('OAuth Client ID is not configured.');
  }

  await ensureGisLoaded();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2?.initTokenClient) {
    throw new Error('Google Identity Services unavailable.');
  }

  const tokenResponse = await new Promise<GisTokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPES.join(' '),
      prompt: selectAccount ? 'select_account' : '',
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        resolve(resp);
      },
      error_callback: (err) => {
        if (err?.type === 'popup_closed') {
          reject(new Error('popup-closed-by-user'));
        } else {
          reject(new Error(err?.message || 'Google sign-in popup could not be completed.'));
        }
      },
    });
    client.requestAccessToken({ prompt: selectAccount ? 'select_account' : '' });
  });

  const token = tokenResponse.access_token;
  if (!token) {
    throw new Error('Google Drive permission was not granted.');
  }

  const expiresInSec = Number(tokenResponse.expires_in || 3500);
  cachedToken = token;
  tokenExpiry = Date.now() + Math.max(300, expiresInSec - 60) * 1000;

  const email = await fetchGoogleUserEmail(token);
  storage.saveBackupMeta({ googleEmail: email });
  const syntheticUser = createSyntheticUser(email);
  notifyAuthListeners(syntheticUser);

  return { user: syntheticUser, accessToken: token };
}

async function connectViaNativeAndroidBridge(): Promise<{
  user: User;
  accessToken: string;
}> {
  const bridge = getNativeDriveBridge();
  if (!bridge || typeof bridge.connectGoogleAccount !== 'function') {
    throw new Error('Native Google account selector unavailable.');
  }

  const email = await new Promise<string>((resolve, reject) => {
    const handler = (evt: Event) => {
      window.removeEventListener('bb-native-drive-auth', handler);
      const customEvt = evt as CustomEvent<{
        success?: boolean;
        email?: string;
        error?: string;
      }>;
      const detail = customEvt.detail;
      if (detail?.success && detail.email) {
        resolve(detail.email);
      } else {
        reject(new Error(detail?.error || 'popup-closed-by-user'));
      }
    };
    window.addEventListener('bb-native-drive-auth', handler);
    bridge.connectGoogleAccount!();
  });

  storage.saveBackupMeta({ googleEmail: email });
  cachedToken = `native_android_drive_token_${email}`;
  tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

  const user = createSyntheticUser(email);
  notifyAuthListeners(user);
  return { user, accessToken: cachedToken };
}

export async function connectGoogleAccount(selectAccount = false): Promise<{
  user: User;
  accessToken: string;
}> {
  // 1. On Android Native APK: Use Android's native AccountManager Google Account Picker
  // (avoids WebView /__/auth/handler "The requested action is invalid" error completely)
  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge) {
    if (!selectAccount) {
      const existingEmail =
        nativeBridge.getConnectedGoogleEmail?.() || storage.getBackupMeta().googleEmail;
      if (existingEmail) {
        const user = createSyntheticUser(existingEmail);
        cachedToken = `native_android_drive_token_${existingEmail}`;
        tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
        notifyAuthListeners(user);
        return { user, accessToken: cachedToken };
      }
    }
    return connectViaNativeAndroidBridge();
  }

  // 2. On Web Browser: Prefer direct Google Identity Services (GIS) OAuth2 Token Client
  // so it talks directly to accounts.google.com and never hits firebaseapp.com/__/auth/handler ("The requested action is invalid")
  if (resolvedFirebaseConfig.oAuthClientId) {
    try {
      return await connectViaGoogleIdentityServices(selectAccount);
    } catch (gisErr) {
      const gisMsg = gisErr instanceof Error ? gisErr.message : '';
      if (gisMsg.includes('popup-closed-by-user') || gisMsg.includes('access_denied')) {
        throw gisErr;
      }
      // If GIS script failed to load (e.g. strict ad-blocker), fall through to Firebase Auth popup
    }
  }

  // 3. Secondary Fallback: Firebase Auth signInWithPopup
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error(
      'Unable to initialize Google Sign-In. Please ensure popups are allowed in your browser.'
    );
  }
  try {
    const provider = createGoogleProvider(selectAccount);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error(
        'Google Drive permission was not granted. Please try again and allow Drive access.'
      );
    }

    cachedToken = token;
    tokenExpiry = Date.now() + 50 * 60 * 1000;

    if (result.user.email) {
      storage.saveBackupMeta({ googleEmail: result.user.email });
    }
    notifyAuthListeners(result.user);

    return { user: result.user, accessToken: token };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (
      rawMsg.toLowerCase().includes('invalid-action') ||
      rawMsg.toLowerCase().includes('requested action is invalid')
    ) {
      throw new Error(
        'Google OAuth redirect could not complete in this embedded view. Please use the updated Busy Bees APK or open in Chrome.'
      );
    }
    throw err;
  }
}

export async function getAccessToken(selectAccount = false): Promise<string> {
  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge && !selectAccount) {
    const existingEmail =
      nativeBridge.getConnectedGoogleEmail?.() || storage.getBackupMeta().googleEmail;
    if (existingEmail) {
      return `native_android_drive_token_${existingEmail}`;
    }
  }
  if (!selectAccount && cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  const { accessToken } = await connectGoogleAccount(selectAccount);
  return accessToken;
}

export async function disconnectGoogleAccount(): Promise<void> {
  invalidateAccessToken();
  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge && typeof nativeBridge.disconnectGoogleAccount === 'function') {
    nativeBridge.disconnectGoogleAccount();
  }
  const auth = getFirebaseAuth();
  if (auth) {
    await firebaseSignOut(auth).catch(() => {});
  }
  storage.saveBackupMeta({ googleEmail: '' });
  notifyAuthListeners(null);
}

export function subscribeAuthUser(callback: (user: User | null) => void): () => void {
  authListeners.add(callback);

  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge) {
    const email = nativeBridge.getConnectedGoogleEmail?.() || storage.getBackupMeta().googleEmail;
    if (email) {
      storage.saveBackupMeta({ googleEmail: email });
      const u = createSyntheticUser(email);
      currentConnectedUser = u;
      callback(u);
    } else {
      callback(null);
    }
    return () => {
      authListeners.delete(callback);
    };
  }

  if (currentConnectedUser) {
    callback(currentConnectedUser);
  } else {
    const savedEmail = storage.getBackupMeta().googleEmail;
    if (savedEmail && cachedToken && Date.now() < tokenExpiry) {
      const u = createSyntheticUser(savedEmail);
      currentConnectedUser = u;
      callback(u);
    }
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    if (!currentConnectedUser) callback(null);
    return () => {
      authListeners.delete(callback);
    };
  }

  const unsubFirebase = onAuthStateChanged(auth, (user) => {
    if (user) {
      if (user.email) {
        storage.saveBackupMeta({ googleEmail: user.email });
      }
      currentConnectedUser = user;
      callback(user);
    } else if (!currentConnectedUser) {
      callback(null);
    }
  });

  return () => {
    authListeners.delete(callback);
    unsubFirebase();
  };
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
 * Searches Google Drive (or Native Android Google Drive bridge)
 * for the latest Busy Bees backup file.
 */
export async function findCloudBackup(token: string): Promise<CloudBackupFileInfo | null> {
  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge) {
    if (typeof nativeBridge.scanCloudBackupInBackground === 'function') {
      await new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          window.removeEventListener('bb-native-drive-scan-result', handler);
          resolve();
        }, 12000);
        const handler = () => {
          window.clearTimeout(timeoutId);
          window.removeEventListener('bb-native-drive-scan-result', handler);
          resolve();
        };
        window.addEventListener('bb-native-drive-scan-result', handler);
        nativeBridge.scanCloudBackupInBackground!();
      });
    }
    const rawMeta = nativeBridge.getCachedBackupMetadataJson?.() || '';
    const rawContent = nativeBridge.getCachedBackupContent?.() || '';
    if (rawMeta && rawContent) {
      try {
        const meta = JSON.parse(rawMeta) as { modifiedTime?: number; sizeBytes?: number };
        const parsedSnap = JSON.parse(rawContent) as AppBackupSnapshot;
        if (parsedSnap && Array.isArray(parsedSnap.transactions)) {
          return {
            id: 'native_cached_backup',
            name: BACKUP_FILE_NAME,
            modifiedTime: new Date(meta.modifiedTime || parsedSnap.createdAt || Date.now()).toISOString(),
            sizeBytes: Number(meta.sizeBytes || rawContent.length),
            txCount: parsedSnap.transactions.length,
            profileName: parsedSnap.profile?.name || undefined,
            currency: parsedSnap.settings?.currency || 'INR',
          };
        }
      } catch {
        // ignore invalid cache
      }
    }
    return null;
  }

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
 * Uploads or overwrites the Busy Bees backup snapshot in Google Drive in the background.
 */
export async function uploadCloudBackup(
  token: string,
  snapshot: AppBackupSnapshot,
  existingFileId?: string,
  interactiveSave = false
): Promise<CloudBackupFileInfo> {
  const jsonContent = JSON.stringify(snapshot, null, 2);
  const contentBytes = new TextEncoder().encode(jsonContent).length;

  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge && typeof nativeBridge.saveBackupToGoogleDrive === 'function') {
    const result = await new Promise<{ modifiedTime: number; sizeBytes: number }>(
      (resolve, reject) => {
        const handler = (evt: Event) => {
          window.removeEventListener('bb-native-drive-backup-result', handler);
          const customEvt = evt as CustomEvent<{
            success?: boolean;
            error?: string;
            modifiedTime?: number;
            sizeBytes?: number;
          }>;
          const detail = customEvt.detail;
          if (detail?.success) {
            resolve({
              modifiedTime: detail.modifiedTime || Date.now(),
              sizeBytes: detail.sizeBytes || contentBytes,
            });
          } else {
            reject(new Error(detail?.error || 'Backup failed'));
          }
        };
        window.addEventListener('bb-native-drive-backup-result', handler);
        nativeBridge.saveBackupToGoogleDrive!(jsonContent, BACKUP_FILE_NAME, interactiveSave);
      }
    );

    const modifiedIso = new Date(result.modifiedTime).toISOString();
    const email =
      nativeBridge.getConnectedGoogleEmail?.() || storage.getBackupMeta().googleEmail || '';

    storage.saveBackupMeta({
      lastBackupTime: result.modifiedTime,
      lastBackupSize: result.sizeBytes,
      lastBackupTxCount: snapshot.transactions.length,
      googleEmail: email,
    });

    return {
      id: 'native_cached_backup',
      name: BACKUP_FILE_NAME,
      modifiedTime: modifiedIso,
      sizeBytes: result.sizeBytes,
      txCount: snapshot.transactions.length,
      profileName: snapshot.profile.name || undefined,
      currency: snapshot.settings.currency,
    };
  }

  let resolvedFileId = existingFileId;
  if (!resolvedFileId) {
    try {
      const existing = await findCloudBackup(token);
      if (existing?.id) {
        resolvedFileId = existing.id;
      }
    } catch {
      // ignore
    }
  }

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

  if (!resolvedFileId) {
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

  const uploadUrl = resolvedFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${resolvedFileId}?uploadType=multipart&fields=id,name,modifiedTime,size,appProperties`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,appProperties`;

  const method = resolvedFileId ? 'PATCH' : 'POST';

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
    googleEmail:
      currentConnectedUser?.email ||
      getFirebaseAuth()?.currentUser?.email ||
      storage.getBackupMeta().googleEmail,
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
 * Opens Android's native Google Drive file picker to select a backup JSON file when restoring on Android.
 */
export async function pickAndDownloadNativeBackup(): Promise<{
  fileInfo: CloudBackupFileInfo;
  snapshot: AppBackupSnapshot;
}> {
  const nativeBridge = getNativeDriveBridge();
  if (!nativeBridge || typeof nativeBridge.openGoogleDriveRestorePicker !== 'function') {
    throw new Error('Native Google Drive picker unavailable.');
  }

  await new Promise<void>((resolve, reject) => {
    const handler = (evt: Event) => {
      window.removeEventListener('bb-native-drive-restore', handler);
      const customEvt = evt as CustomEvent<{ success?: boolean; error?: string }>;
      const detail = customEvt.detail;
      if (detail?.success) {
        resolve();
      } else {
        reject(new Error(detail?.error || 'popup-closed-by-user'));
      }
    };
    window.addEventListener('bb-native-drive-restore', handler);
    nativeBridge.openGoogleDriveRestorePicker!();
  });

  const rawContent = nativeBridge.getCachedBackupContent?.() || '';
  if (!rawContent) {
    throw new Error('The selected backup file is empty.');
  }

  let parsed: AppBackupSnapshot;
  try {
    parsed = JSON.parse(rawContent) as AppBackupSnapshot;
  } catch {
    throw new Error('The selected file is not a valid Busy Bees backup JSON.');
  }

  if (!parsed || !Array.isArray(parsed.transactions)) {
    throw new Error('The backup file on Google Drive is invalid or corrupted.');
  }

  const sizeBytes = new TextEncoder().encode(rawContent).length;
  const modifiedTime = parsed.createdAt
    ? new Date(parsed.createdAt).toISOString()
    : new Date().toISOString();

  return {
    fileInfo: {
      id: 'native_cached_backup',
      name: BACKUP_FILE_NAME,
      modifiedTime,
      sizeBytes,
      txCount: parsed.transactions.length,
      profileName: parsed.profile?.name || undefined,
      currency: parsed.settings?.currency || 'INR',
    },
    snapshot: parsed,
  };
}

/**
 * Downloads the backup JSON from Google Drive and parses it.
 */
export async function downloadCloudBackup(
  token: string,
  fileId: string
): Promise<AppBackupSnapshot> {
  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge) {
    let rawContent = nativeBridge.getCachedBackupContent?.() || '';
    if (!rawContent) {
      await findCloudBackup(token);
      rawContent = nativeBridge.getCachedBackupContent?.() || '';
    }
    if (rawContent) {
      const parsed = JSON.parse(rawContent) as AppBackupSnapshot;
      if (parsed && Array.isArray(parsed.transactions)) {
        return parsed;
      }
    }
    throw new Error('No Busy Bees backup file was found in Google Drive.');
  }

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
  const nativeBridge = getNativeDriveBridge();
  if (nativeBridge) {
    nativeBridge.deleteCachedBackup?.();
    storage.saveBackupMeta({
      lastBackupTime: null,
      lastBackupSize: null,
      lastBackupTxCount: null,
    });
    return;
  }

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
