import { todayISO } from '../domain/dates';
import { buildBackup } from './backup';
import { updateSettings } from './repo';

/** Saves a backup file. Returns false if you cancelled, so no backup is recorded. */
export async function saveBackupFile(): Promise<boolean> {
  const backup = await buildBackup();
  const name = `pocket-backup-${todayISO()}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  // Home-screen apps on phones handle the share menu better than downloads.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch {
      return false;
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  await updateSettings({ lastBackupAt: backup.exportedAt });
  return true;
}
