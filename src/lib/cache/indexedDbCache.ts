export type CacheNamespace = 'tmdb' | 'anilist' | 'tvdb' | 'fribb';

export interface CacheNamespacePolicy {
  freshTtlMs: number;
  staleWindowMs: number;
}

export const CACHE_DB_NAME = 'miyoro_api_cache';
export const CACHE_DB_VERSION = 1;
export const CACHE_STORE_NAME = 'cache_entries';
export const CACHE_SCHEMA_VERSION = 1;

export const DEFAULT_MAX_CACHE_ENTRIES = 1500;
export const DEFAULT_MAX_CACHE_BYTES = 15 * 1024 * 1024; // 15 MB

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CACHE_NAMESPACE_POLICIES: Record<CacheNamespace, CacheNamespacePolicy> = {
  tmdb: {
    freshTtlMs: 6 * HOUR_MS,
    staleWindowMs: 24 * HOUR_MS,
  },
  anilist: {
    freshTtlMs: 6 * HOUR_MS,
    staleWindowMs: 24 * HOUR_MS,
  },
  tvdb: {
    freshTtlMs: 12 * HOUR_MS,
    staleWindowMs: 48 * HOUR_MS,
  },
  fribb: {
    freshTtlMs: 24 * HOUR_MS,
    staleWindowMs: 7 * DAY_MS,
  },
};

export interface IndexedDbCacheRecord<T = unknown> {
  id: string;
  key: string;
  namespace: CacheNamespace;
  schemaVersion: number;
  value: T;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  staleUntil: number;
  lastAccessedAt: number;
  approxBytes: number;
}

export interface IndexedDbCacheLookup<T = unknown> {
  status: 'fresh' | 'stale';
  value: T;
  record: IndexedDbCacheRecord<T>;
}

export interface IndexedDbSetOptions<T = unknown> {
  freshTtlMs?: number;
  staleWindowMs?: number;
  updatedAt?: number;
  validate?: (value: T) => boolean;
}

export interface IndexedDbGetOptions<T = unknown> {
  validate?: (value: T) => boolean;
  touchOnRead?: boolean;
}

export interface IndexedDbRuntimeConfig {
  idbFactory?: IDBFactory | null;
  now?: () => number;
  maxEntries?: number;
  maxBytes?: number;
  maintenanceWriteInterval?: number;
  dbOpenTimeoutMs?: number;
}

const VALID_NAMESPACES = new Set<CacheNamespace>(['tmdb', 'anilist', 'tvdb', 'fribb']);

/**
 * Fast, bounded structural size estimation in bytes without full JSON serialization.
 * Caps collection sampling so large payloads (such as Fribb's ~1MB mapping array)
 * are estimated in sub-millisecond time while staying accurate enough for budget tracking.
 */
export function estimateApproxBytes(value: unknown, depth = 0): number {
  if (value === null || value === undefined) return 8;

  const primitiveType = typeof value;
  if (primitiveType === 'boolean') return 4;
  if (primitiveType === 'number') return 8;
  if (primitiveType === 'string') return 16 + (value as string).length * 2;

  if (depth >= 4) return 64;

  if (Array.isArray(value)) {
    const len = value.length;
    if (len === 0) return 24;
    const sampleSize = Math.min(len, 24);
    let sampleBytes = 0;
    const step = Math.max(1, Math.floor(len / sampleSize));
    let count = 0;
    for (let i = 0; i < len && count < sampleSize; i += step) {
      sampleBytes += estimateApproxBytes(value[i], depth + 1);
      count++;
    }
    const avgElementBytes = count > 0 ? Math.ceil(sampleBytes / count) : 32;
    return 32 + len * avgElementBytes;
  }

  if (primitiveType === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const len = keys.length;
    if (len === 0) return 24;
    const sampleSize = Math.min(len, 24);
    let total = 32;
    for (let i = 0; i < sampleSize; i++) {
      const k = keys[i];
      total += 16 + k.length * 2 + estimateApproxBytes(obj[k], depth + 1);
    }
    if (len > sampleSize) {
      total = Math.ceil((total / sampleSize) * len);
    }
    return total;
  }

  return 32;
}

export function buildCacheRecordId(namespace: CacheNamespace, key: string): string {
  return `${namespace}:${key}`;
}

function isValidCacheRecord<T>(
  raw: unknown,
  expectedNamespace: CacheNamespace,
  expectedKey: string
): raw is IndexedDbCacheRecord<T> {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as IndexedDbCacheRecord<T>;
  if (rec.schemaVersion !== CACHE_SCHEMA_VERSION) return false;
  if (rec.namespace !== expectedNamespace) return false;
  if (rec.key !== expectedKey) return false;
  if (typeof rec.id !== 'string' || !rec.id) return false;
  if (!VALID_NAMESPACES.has(rec.namespace)) return false;
  if (typeof rec.createdAt !== 'number' || !Number.isFinite(rec.createdAt)) return false;
  if (typeof rec.updatedAt !== 'number' || !Number.isFinite(rec.updatedAt)) return false;
  if (typeof rec.expiresAt !== 'number' || !Number.isFinite(rec.expiresAt)) return false;
  if (typeof rec.staleUntil !== 'number' || !Number.isFinite(rec.staleUntil)) return false;
  if (typeof rec.lastAccessedAt !== 'number' || !Number.isFinite(rec.lastAccessedAt)) return false;
  if (typeof rec.approxBytes !== 'number' || !Number.isFinite(rec.approxBytes) || rec.approxBytes < 0) return false;
  if (rec.value === undefined || rec.value === null) return false;
  return true;
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name || '';
  const message = (err as { message?: string }).message || '';
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    message.toLowerCase().includes('quota')
  );
}

class NativeIndexedDbCache {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private dbInstance: IDBDatabase | null = null;
  private inFlightGets = new Map<string, Promise<IndexedDbCacheLookup<any> | null>>();
  private latestWriteTimestampByKey = new Map<string, number>();
  private writesSinceMaintenance = 0;
  private maintenancePromise: Promise<void> | null = null;
  private config: Required<Omit<IndexedDbRuntimeConfig, 'idbFactory'>> & {
    idbFactory?: IDBFactory | null;
  } = {
    idbFactory: undefined,
    now: () => Date.now(),
    maxEntries: DEFAULT_MAX_CACHE_ENTRIES,
    maxBytes: DEFAULT_MAX_CACHE_BYTES,
    maintenanceWriteInterval: 20,
    dbOpenTimeoutMs: 1500,
  };

  public configure(overrides: IndexedDbRuntimeConfig): void {
    this.config = {
      ...this.config,
      ...overrides,
    };
  }

  public resetRuntimeState(): void {
    this.closeConnection();
    this.inFlightGets.clear();
    this.latestWriteTimestampByKey.clear();
    this.writesSinceMaintenance = 0;
    this.maintenancePromise = null;
    this.config = {
      idbFactory: undefined,
      now: () => Date.now(),
      maxEntries: DEFAULT_MAX_CACHE_ENTRIES,
      maxBytes: DEFAULT_MAX_CACHE_BYTES,
      maintenanceWriteInterval: 20,
      dbOpenTimeoutMs: 1500,
    };
  }

  public closeConnection(): void {
    if (this.dbInstance) {
      try {
        this.dbInstance.close();
      } catch {
        // Ignore close errors
      }
      this.dbInstance = null;
    }
    this.dbPromise = null;
  }

  private getIdbFactory(): IDBFactory | null {
    if (this.config.idbFactory !== undefined) {
      return this.config.idbFactory;
    }
    try {
      if (typeof globalThis !== 'undefined' && globalThis.indexedDB) {
        return globalThis.indexedDB;
      }
    } catch {
      // SecurityError in restricted iframe or private browsing
    }
    return null;
  }

  public isAvailable(): boolean {
    return this.getIdbFactory() !== null;
  }

  private async openDatabase(): Promise<IDBDatabase | null> {
    if (this.dbInstance) {
      return this.dbInstance;
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    const idb = this.getIdbFactory();
    if (!idb) {
      return null;
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      let settled = false;
      const finish = (db: IDBDatabase | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (!db) {
          this.dbPromise = null;
        }
        resolve(db);
      };

      const timeoutId = setTimeout(() => {
        finish(null);
      }, this.config.dbOpenTimeoutMs);

      let request: IDBOpenDBRequest;
      try {
        request = idb.open(CACHE_DB_NAME, CACHE_DB_VERSION);
      } catch {
        finish(null);
        return;
      }

      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
            store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' });
          } else if (request.transaction) {
            store = request.transaction.objectStore(CACHE_STORE_NAME);
          } else {
            return;
          }

          if (!store.indexNames.contains('by_namespace')) {
            store.createIndex('by_namespace', 'namespace', { unique: false });
          }
          if (!store.indexNames.contains('by_expiresAt')) {
            store.createIndex('by_expiresAt', 'expiresAt', { unique: false });
          }
          if (!store.indexNames.contains('by_staleUntil')) {
            store.createIndex('by_staleUntil', 'staleUntil', { unique: false });
          }
          if (!store.indexNames.contains('by_lastAccessedAt')) {
            store.createIndex('by_lastAccessedAt', 'lastAccessedAt', { unique: false });
          }
        } catch {
          // If schema creation fails, onerror/onabort will resolve null
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        this.dbInstance = db;

        db.onversionchange = () => {
          this.closeConnection();
        };
        db.onclose = () => {
          if (this.dbInstance === db) {
            this.dbInstance = null;
            this.dbPromise = null;
          }
        };

        finish(db);
      };

      request.onerror = () => {
        finish(null);
      };

      request.onblocked = () => {
        finish(null);
      };
    });

    return this.dbPromise;
  }

  public async get<T>(
    namespace: CacheNamespace,
    key: string,
    options?: IndexedDbGetOptions<T>
  ): Promise<IndexedDbCacheLookup<T> | null> {
    if (!key || !VALID_NAMESPACES.has(namespace)) return null;

    const id = buildCacheRecordId(namespace, key);
    const existingInFlight = this.inFlightGets.get(id);
    if (existingInFlight) {
      return existingInFlight as Promise<IndexedDbCacheLookup<T> | null>;
    }

    const lookupPromise = this.performGet<T>(namespace, key, id, options).finally(() => {
      this.inFlightGets.delete(id);
    });

    this.inFlightGets.set(id, lookupPromise);
    return lookupPromise;
  }

  private async performGet<T>(
    namespace: CacheNamespace,
    key: string,
    id: string,
    options?: IndexedDbGetOptions<T>
  ): Promise<IndexedDbCacheLookup<T> | null> {
    const db = await this.openDatabase();
    if (!db) return null;

    const rawRecord = await new Promise<unknown>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
        tx.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    if (!rawRecord) return null;

    if (!isValidCacheRecord<T>(rawRecord, namespace, key)) {
      void this.delete(namespace, key);
      return null;
    }

    if (options?.validate && !options.validate(rawRecord.value)) {
      void this.delete(namespace, key);
      return null;
    }

    const now = this.config.now();
    if (now >= rawRecord.staleUntil) {
      void this.delete(namespace, key);
      return null;
    }

    const status: 'fresh' | 'stale' = now < rawRecord.expiresAt ? 'fresh' : 'stale';

    if (options?.touchOnRead !== false) {
      rawRecord.lastAccessedAt = now;
      void this.touchRecord(db, rawRecord);
    }

    return {
      status,
      value: rawRecord.value,
      record: rawRecord,
    };
  }

  private async touchRecord<T>(db: IDBDatabase, record: IndexedDbCacheRecord<T>): Promise<void> {
    const latestWrite = this.latestWriteTimestampByKey.get(record.id);
    if (latestWrite !== undefined && latestWrite > record.updatedAt) {
      return;
    }

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async set<T>(
    namespace: CacheNamespace,
    key: string,
    value: T,
    options?: IndexedDbSetOptions<T>
  ): Promise<boolean> {
    if (!key || !VALID_NAMESPACES.has(namespace)) return false;
    if (value === null || value === undefined) return false;
    if (options?.validate && !options.validate(value)) return false;

    const id = buildCacheRecordId(namespace, key);
    const now = this.config.now();
    const updatedAt = options?.updatedAt ?? now;

    // Prevent older out-of-order network responses from overwriting newer cache writes
    const knownLatest = this.latestWriteTimestampByKey.get(id);
    if (knownLatest !== undefined && updatedAt < knownLatest) {
      return false;
    }

    const approxBytes = estimateApproxBytes(value) + 128;
    // Refuse single records larger than the entire cache byte budget
    if (approxBytes > this.config.maxBytes) {
      return false;
    }

    const policy = CACHE_NAMESPACE_POLICIES[namespace];
    const freshTtlMs = Math.max(1, options?.freshTtlMs ?? policy.freshTtlMs);
    const staleWindowMs = Math.max(freshTtlMs, options?.staleWindowMs ?? policy.staleWindowMs);

    const db = await this.openDatabase();
    if (!db) return false;

    const record: IndexedDbCacheRecord<T> = {
      id,
      key,
      namespace,
      schemaVersion: CACHE_SCHEMA_VERSION,
      value,
      createdAt: now,
      updatedAt,
      expiresAt: now + freshTtlMs,
      staleUntil: now + staleWindowMs,
      lastAccessedAt: now,
      approxBytes,
    };

    // Reserve timestamp before starting async transaction
    this.latestWriteTimestampByKey.set(id, updatedAt);

    let writeResult = await this.putRecordIfNewer(db, record);

    if (writeResult === 'quota_exceeded') {
      await this.runMaintenance(true);
      writeResult = await this.putRecordIfNewer(db, record);
    }

    if (writeResult !== 'written') {
      return false;
    }

    this.writesSinceMaintenance++;
    if (
      this.writesSinceMaintenance >= this.config.maintenanceWriteInterval ||
      approxBytes >= this.config.maxBytes * 0.2
    ) {
      this.writesSinceMaintenance = 0;
      void this.runMaintenance(false);
    }

    return true;
  }

  private async putRecordIfNewer<T>(
    db: IDBDatabase,
    record: IndexedDbCacheRecord<T>
  ): Promise<'written' | 'skipped_older' | 'quota_exceeded' | 'error'> {
    return new Promise((resolve) => {
      let quotaExceeded = false;
      let skippedOlder = false;

      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const existingReq = store.get(record.id);

        existingReq.onsuccess = () => {
          const existing = existingReq.result as IndexedDbCacheRecord<unknown> | undefined;
          if (
            existing &&
            typeof existing === 'object' &&
            typeof existing.updatedAt === 'number' &&
            existing.updatedAt > record.updatedAt
          ) {
            skippedOlder = true;
            this.latestWriteTimestampByKey.set(record.id, existing.updatedAt);
            return;
          }

          if (existing && typeof existing.createdAt === 'number') {
            record.createdAt = existing.createdAt;
          }

          try {
            const putReq = store.put(record);
            putReq.onerror = () => {
              if (isQuotaExceededError(putReq.error)) {
                quotaExceeded = true;
              }
            };
          } catch (err) {
            if (isQuotaExceededError(err)) {
              quotaExceeded = true;
            }
          }
        };

        existingReq.onerror = () => {
          try {
            store.put(record);
          } catch (err) {
            if (isQuotaExceededError(err)) {
              quotaExceeded = true;
            }
          }
        };

        tx.oncomplete = () => {
          if (skippedOlder) {
            resolve('skipped_older');
          } else {
            resolve('written');
          }
        };

        tx.onabort = () => {
          if (quotaExceeded || isQuotaExceededError(tx.error)) {
            resolve('quota_exceeded');
          } else {
            resolve('error');
          }
        };

        tx.onerror = () => {
          if (quotaExceeded || isQuotaExceededError(tx.error)) {
            resolve('quota_exceeded');
          } else {
            resolve('error');
          }
        };
      } catch (err) {
        if (isQuotaExceededError(err)) {
          resolve('quota_exceeded');
        } else {
          resolve('error');
        }
      }
    });
  }

  public async delete(namespace: CacheNamespace, key: string): Promise<boolean> {
    if (!key || !VALID_NAMESPACES.has(namespace)) return false;
    const id = buildCacheRecordId(namespace, key);
    this.latestWriteTimestampByKey.delete(id);

    const db = await this.openDatabase();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async clearNamespace(namespace: CacheNamespace): Promise<boolean> {
    if (!VALID_NAMESPACES.has(namespace)) return false;

    for (const key of Array.from(this.latestWriteTimestampByKey.keys())) {
      if (key.startsWith(`${namespace}:`)) {
        this.latestWriteTimestampByKey.delete(key);
      }
    }

    const db = await this.openDatabase();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const allRecords = Array.isArray(req.result) ? req.result : [];
          for (const rec of allRecords) {
            if (rec && typeof rec === 'object' && rec.namespace === namespace && typeof rec.id === 'string') {
              store.delete(rec.id);
            }
          }
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async clearAll(): Promise<boolean> {
    this.latestWriteTimestampByKey.clear();
    this.inFlightGets.clear();

    const db = await this.openDatabase();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Bounded maintenance pass:
   * 1. Deletes corrupted records or records past their `staleUntil` window.
   * 2. If total entries > `maxEntries` or total bytes > `maxBytes` (or `aggressiveQuotaCleanup` is true),
   *    evicts stale entries first (oldest `lastAccessedAt` first), then least-recently-used fresh entries
   *    until both count and byte budgets are satisfied.
   */
  public async runMaintenance(aggressiveQuotaCleanup = false): Promise<void> {
    if (this.maintenancePromise) {
      return this.maintenancePromise;
    }

    this.maintenancePromise = this.performMaintenance(aggressiveQuotaCleanup).finally(() => {
      this.maintenancePromise = null;
    });

    return this.maintenancePromise;
  }

  private async performMaintenance(aggressiveQuotaCleanup: boolean): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return;

    const allRecords = await new Promise<unknown[]>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
        tx.onabort = () => resolve([]);
        tx.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });

    if (allRecords.length === 0) return;

    const now = this.config.now();
    const idsToDelete: string[] = [];
    const validSurvivors: IndexedDbCacheRecord<unknown>[] = [];

    for (const raw of allRecords) {
      if (!raw || typeof raw !== 'object') continue;
      const candidate = raw as Partial<IndexedDbCacheRecord<unknown>>;
      const id = typeof candidate.id === 'string' ? candidate.id : null;
      if (
        !id ||
        typeof candidate.namespace !== 'string' ||
        typeof candidate.key !== 'string' ||
        !isValidCacheRecord(raw, candidate.namespace as CacheNamespace, candidate.key)
      ) {
        if (id) idsToDelete.push(id);
        continue;
      }

      if (now >= raw.staleUntil) {
        idsToDelete.push(raw.id);
      } else {
        validSurvivors.push(raw);
      }
    }

    const targetMaxEntries = aggressiveQuotaCleanup
      ? Math.max(1, Math.floor(this.config.maxEntries * 0.75))
      : this.config.maxEntries;
    const targetMaxBytes = aggressiveQuotaCleanup
      ? Math.max(1024, Math.floor(this.config.maxBytes * 0.75))
      : this.config.maxBytes;

    let currentCount = validSurvivors.length;
    let currentBytes = validSurvivors.reduce((sum, rec) => sum + (rec.approxBytes || 0), 0);

    if (currentCount > targetMaxEntries || currentBytes > targetMaxBytes) {
      // Sort eviction candidates:
      // 1. Stale entries (now >= expiresAt) before fresh entries
      // 2. Oldest lastAccessedAt first (LRU)
      // 3. Oldest updatedAt as deterministic tie-breaker
      validSurvivors.sort((a, b) => {
        const aIsStale = now >= a.expiresAt ? 0 : 1;
        const bIsStale = now >= b.expiresAt ? 0 : 1;
        if (aIsStale !== bIsStale) return aIsStale - bIsStale;
        if (a.lastAccessedAt !== b.lastAccessedAt) return a.lastAccessedAt - b.lastAccessedAt;
        return a.updatedAt - b.updatedAt;
      });

      for (const rec of validSurvivors) {
        if (currentCount <= targetMaxEntries && currentBytes <= targetMaxBytes) {
          break;
        }
        idsToDelete.push(rec.id);
        currentCount--;
        currentBytes -= rec.approxBytes || 0;
      }
    }

    if (idsToDelete.length === 0) return;

    for (const id of idsToDelete) {
      this.latestWriteTimestampByKey.delete(id);
    }

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        for (const id of idsToDelete) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async getStats(): Promise<{ totalEntries: number; totalApproxBytes: number }> {
    const db = await this.openDatabase();
    if (!db) return { totalEntries: 0, totalApproxBytes: 0 };

    const records = await new Promise<IndexedDbCacheRecord<unknown>[]>((resolve) => {
      try {
        const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
        tx.onabort = () => resolve([]);
        tx.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });

    let totalApproxBytes = 0;
    for (const rec of records) {
      if (rec && typeof rec.approxBytes === 'number' && Number.isFinite(rec.approxBytes)) {
        totalApproxBytes += rec.approxBytes;
      }
    }

    return {
      totalEntries: records.length,
      totalApproxBytes,
    };
  }
}

export const indexedDbCache = new NativeIndexedDbCache();
