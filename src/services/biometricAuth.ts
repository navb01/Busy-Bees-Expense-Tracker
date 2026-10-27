export interface BiometricAuthResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

interface BusyBeesNativeBridge {
  exitApp?: () => void;
  setDarkMode?: (isDark: boolean) => void;
  isBiometricAvailable?: () => string;
  authenticateBiometric?: () => void;
}

const WEBAUTHN_CRED_KEY = 'bb_webauthn_biometric_cred_v1';

function getNativeBridge(): BusyBeesNativeBridge | undefined {
  return (window as unknown as { BusyBeesNative?: BusyBeesNativeBridge }).BusyBeesNative;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

function randomChallenge(length = 32): ArrayBuffer {
  const buffer = new ArrayBuffer(length);
  const arr = new Uint8Array(buffer);
  window.crypto.getRandomValues(arr);
  return buffer;
}

export async function isBiometricSupported(): Promise<{
  available: boolean;
  status: 'AVAILABLE' | 'NONE_ENROLLED' | 'UNAVAILABLE';
}> {
  const native = getNativeBridge();
  if (native && typeof native.isBiometricAvailable === 'function') {
    try {
      const status = native.isBiometricAvailable();
      if (status === 'AVAILABLE') {
        return { available: true, status: 'AVAILABLE' };
      }
      if (status === 'NONE_ENROLLED') {
        return { available: false, status: 'NONE_ENROLLED' };
      }
      return { available: false, status: 'UNAVAILABLE' };
    } catch {
      return { available: false, status: 'UNAVAILABLE' };
    }
  }

  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return {
        available,
        status: available ? 'AVAILABLE' : 'UNAVAILABLE',
      };
    } catch {
      return { available: false, status: 'UNAVAILABLE' };
    }
  }

  return { available: false, status: 'UNAVAILABLE' };
}

export async function authenticateWithBiometrics(): Promise<BiometricAuthResult> {
  const native = getNativeBridge();

  // 1. Native Android Bridge (Capacitor APK)
  if (native && typeof native.authenticateBiometric === 'function') {
    return new Promise<BiometricAuthResult>((resolve) => {
      let settled = false;

      const cleanup = () => {
        window.removeEventListener('bb-biometric-result', handleResult as EventListener);
      };

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          success: false,
          cancelled: true,
          error: 'Biometric prompt timed out.',
        });
      }, 60000);

      const handleResult = (event: Event) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();

        const customEvent = event as CustomEvent<{
          success: boolean;
          code?: string;
          error?: string;
        }>;
        const detail = customEvent.detail || { success: false };

        if (detail.success) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            cancelled: detail.code === 'CANCELLED',
            error: detail.error || 'Biometric verification failed.',
          });
        }
      };

      window.addEventListener('bb-biometric-result', handleResult as EventListener);

      try {
        native.authenticateBiometric!();
      } catch {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          cleanup();
          resolve({
            success: false,
            error: 'Could not launch biometric sensor.',
          });
        }
      }
    });
  }

  // 2. Web / PWA Platform Authenticator (WebAuthn Fingerprint / Face ID / Touch ID / Windows Hello)
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    navigator.credentials
  ) {
    try {
      const supported = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!supported) {
        return {
          success: false,
          error: 'Biometric sensor is not available on this device.',
        };
      }

      const existingCredId = localStorage.getItem(WEBAUTHN_CRED_KEY);

      if (existingCredId) {
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge: randomChallenge(),
            allowCredentials: [
              {
                id: base64UrlToBuffer(existingCredId),
                type: 'public-key',
                transports: ['internal'],
              },
            ],
            userVerification: 'required',
            timeout: 60000,
          },
        });

        if (assertion) {
          return { success: true };
        }
      } else {
        const userId = randomChallenge(16);
        const credential = (await navigator.credentials.create({
          publicKey: {
            challenge: randomChallenge(),
            rp: {
              name: 'Busy Bees Expense Tracker',
            },
            user: {
              id: userId,
              name: 'busybees-local-user',
              displayName: 'Busy Bees User',
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' },   // ES256
              { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
              residentKey: 'preferred',
            },
            timeout: 60000,
          },
        })) as PublicKeyCredential | null;

        if (credential && credential.rawId) {
          localStorage.setItem(WEBAUTHN_CRED_KEY, bufferToBase64Url(credential.rawId));
          return { success: true };
        }
      }

      return {
        success: false,
        error: 'Biometric verification was not completed.',
      };
    } catch (err: unknown) {
      const domErr = err as { name?: string; message?: string };
      if (domErr?.name === 'NotAllowedError' || domErr?.name === 'AbortError') {
        return {
          success: false,
          cancelled: true,
          error: 'Biometric prompt was cancelled.',
        };
      }
      return {
        success: false,
        error: 'Biometric authentication is unavailable in this environment. Please use your 4-digit PIN.',
      };
    }
  }

  return {
    success: false,
    error: 'Biometric authentication is not supported on this device.',
  };
}
