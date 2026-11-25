import { defaultData } from './defaults';
import type { AppData } from './types';

export function demoData(_variant = ''): AppData {
  return defaultData();
}
