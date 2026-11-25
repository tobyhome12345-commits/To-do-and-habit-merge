import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from '../core/platform';
import { backupFileName, exportJSON, parseBackup } from './backup';
import type { AppData } from './types';
import { useData } from './store';
import { useUI } from './ui';

/*
 * Saving and opening backup files (both apps had a copy of this).
 * Phone: the share sheet (save to Drive / Files / send to yourself). Browser: a download.
 */

export async function exportBackup(data: AppData): Promise<'shared' | 'downloaded'> {
  const json = exportJSON(data, Date.now(), __APP_VERSION__);
  const name = backupFileName();
  if (isNative) {
    const res = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({
      title: 'Tickday backup',
      text: `Tickday backup (${data.habits.habits.length} habits, ${data.todo.tasks.length} tasks)`,
      files: [res.uri],
      dialogTitle: 'Save your Tickday backup',
    });
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

/** Read a picked file as text. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** Read a backup file (Tickday, Habit Tracker or Doable) and open the import sheet for it. */
export async function openBackupFile(file: File) {
  try {
    const plan = parseBackup(await readFileText(file));
    useUI.getState().openSheet({ kind: 'import', plan });
  } catch (err) {
    useData.getState().showSnack(err instanceof Error ? err.message : 'Could not read that file', undefined, '⚠️');
  }
}

/** Show the phone's file picker for a backup file. */
export function pickBackupFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json,text/plain,*/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void openBackupFile(f);
  };
  input.click();
}
