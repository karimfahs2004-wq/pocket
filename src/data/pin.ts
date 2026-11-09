/**
 * 4-digit PIN lock. Only a salted hash of the PIN is stored, never the PIN itself.
 * It's a privacy screen for your unlocked phone, not encryption of your data.
 */
import { getSettings, updateSettings } from './repo';
import { db } from './db';

export const PIN_LENGTH = 4;

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

async function hash(pin: string, salt: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)));
}

export async function setPin(pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  await updateSettings({ pinSalt: salt, pinHash: await hash(pin, salt) });
}

export async function checkPin(pin: string): Promise<boolean> {
  const s = await getSettings();
  return !!s.pinHash && !!s.pinSalt && (await hash(pin, s.pinSalt)) === s.pinHash;
}

export async function removePin() {
  await db.settings.bulkDelete(['pinHash', 'pinSalt']);
}

/** Face ID was removed, so clear what it left behind. */
export const clearOldFaceIdLock = () => db.settings.delete('lockCredentialId');
