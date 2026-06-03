/**
 * In-memory store — the synchronous source pages read from.
 *
 *  - Demo mode: seeded from mockData, mutations stay in memory, resets on reload.
 *  - Live mode: hydrate() replaces arrays with caller-scoped D1 data; wt() writes
 *    through to /api/data/upsert. Public/global data (facility directory) is NOT
 *    kept here — it comes from dedicated public endpoints so hydrate can't clobber it.
 */
import { useSyncExternalStore } from 'react';
import { freshStore, type StoreData } from './mockData.js';
import { isLive } from './config.js';
import { api, ApiError } from './api.js';

type Table = keyof StoreData;

let data: StoreData = freshStore();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getVersion(): number {
  return version;
}

/** Force a re-render after a direct in-memory mutation (demo mode). */
export function touch(): void {
  emit();
}

/** Read a table synchronously (live snapshot array). */
export function table<T extends Table>(name: T): StoreData[T] {
  return data[name];
}

export function getData(): StoreData {
  return data;
}

/** Reset the demo sandbox to its pristine seed. */
export function resetDemo(): void {
  data = freshStore();
  emit();
}

/** Replace store arrays with caller-scoped data from /api/data/hydrate. */
export function hydrate(payload: Partial<StoreData>): void {
  for (const key of Object.keys(payload) as Table[]) {
    const rows = payload[key];
    if (Array.isArray(rows)) {
      (data[key] as unknown[]) = rows;
    }
  }
  emit();
}

/** Upsert a row into the store and (when live) write through to D1. */
export async function wt<T extends Table>(
  name: T,
  row: StoreData[T][number],
): Promise<void> {
  const r = row as { id: string; updated_at?: string };
  const base = r.updated_at;
  r.updated_at = new Date().toISOString();

  // Optimistic local update.
  const arr = data[name] as { id: string }[];
  const idx = arr.findIndex((x) => x.id === r.id);
  if (idx >= 0) arr[idx] = row as { id: string };
  else arr.push(row as { id: string });
  emit();

  if (!isLive()) return;

  try {
    const res = await api<{ row?: StoreData[T][number] }>('/data/upsert', {
      body: { table: name, row, base_updated_at: base },
    });
    if (res.row) {
      const i = (data[name] as { id: string }[]).findIndex((x) => x.id === r.id);
      if (i >= 0) (data[name] as unknown[])[i] = res.row;
      emit();
    }
  } catch (e) {
    if (e instanceof ApiError && e.conflict) {
      // Reconcile by re-hydrating rather than clobbering.
      await rehydrate();
      throw e;
    }
    throw e;
  }
}

/** Delete a row from the store and (when live) from D1. */
export async function remove(name: Table, id: string): Promise<void> {
  const arr = data[name] as { id: string }[];
  const idx = arr.findIndex((x) => x.id === id);
  if (idx >= 0) arr.splice(idx, 1);
  emit();
  if (!isLive()) return;
  await api('/data/delete', { body: { table: name, id } });
}

/** Re-pull caller-scoped data from D1. */
export async function rehydrate(): Promise<void> {
  if (!isLive()) return;
  const payload = await api<Partial<StoreData>>('/data/hydrate');
  hydrate(payload);
}

/**
 * React hook: subscribe via the version counter (a stable primitive snapshot)
 * and compute the selector fresh each render. This is safe even though selectors
 * return new array references, because the snapshot fed to React is the number.
 */
export function useStore<R>(selector: (d: StoreData) => R): R {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return selector(data);
}

/** Convenience: read a table reactively. */
export function useTable<T extends Table>(name: T): StoreData[T] {
  return useStore((d) => d[name]);
}
