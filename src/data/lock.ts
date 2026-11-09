/**
 * Face ID lock, using the phone's built-in passkeys (WebAuthn). Face ID or Touch ID is
 * checked by the phone itself, and falls back to your passcode if it fails.
 *
 * There's no server, so this is a privacy screen, not encryption: it stops someone with
 * your unlocked phone from opening Pocket.
 */
const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function lockAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Creates this phone's passkey. Returns its id, or throws if you cancelled. */
export async function createLock(): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Pocket', id: location.hostname },
      user: { id: random(16), name: 'Pocket lock', displayName: 'Pocket lock' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('cancelled');
  return toB64(cred.rawId);
}

/** Asks for Face ID. True only if the phone confirmed it was you. */
export async function unlock(credentialId: string): Promise<boolean> {
  try {
    const a = (await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!a) return false;
    // Byte 32 of the authenticator data holds flags; bit 2 means the user was verified.
    const flags = new Uint8Array((a.response as AuthenticatorAssertionResponse).authenticatorData)[32];
    return (flags & 0x04) !== 0;
  } catch {
    return false;
  }
}
