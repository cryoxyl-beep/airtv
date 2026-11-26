import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CACHE_DB_NAME,
  CACHE_NAMESPACE_POLICIES,
  CACHE_SCHEMA_VERSION,
  CACHE_STORE_NAME,
  buildCacheRecordId,
  estimateApproxBytes,
  indexedDbCache,
  type CacheNamespace,
} from '../src/lib/cache/indexedDbCache';
import {
  FRIBB_CACHE_KEY,
  preloadFribbMapping,
  resetFribbClientCache,
  resolveAnimeMapping,
} from '../src/api/fribb';
import {
  TVDB_EPISODES_CACHE_PREFIX,
  fetchTVDBEpisodesForSeries,
  resetTvdbClientCache,
} from '../src/api/tvdb';
import {
  ANILIST_SESSION_CACHE_PREFIX,
  fetchTrendingAnime,
  resetAnilistClientCache,
  searchAnime,
} from '../src/api/anilist';
import {
  fetchDetails,
  fetchPersonCombinedCredits,
  fetchPersonDetails,
  fetchTrending,
  getCachedLogo,
  getCachedPersonCombinedCredits,
  getCachedPersonDetails,
  getSeedItem,
  hasCachedLogoEntry,
  resetTmdbClientCache,
} from '../src/api/tmdb';

/**
 * Lightweight, spec-compliant in-memory IDBFactory / IDBDatabase / IDBTransaction / IDBObjectStore
 * mock for Node test environments with zero external dependencies.
 * Supports:
 * - Asynchronous request lifecycle (`onupgradeneeded`, `onsuccess`, `onerror`, `onblocked`)
 * - Structured cloning via `structuredClone`
 * - Simulated `onblocked`, transaction errors, and `QuotaExceededError` on demand
 */
interface MockIdbOptions {
  simulateBlockedOpen?: boolean;
  simulateOpenError?: boolean;
  simulateGetError?: boolean;
  quotaExceededOnNthPut?: number;
}

function createMockIdbFactory(options: MockIdbOptions = {}) {
  const databases = new Map<
    string,
    {
      version: number;
      stores: Map<string, { keyPath: string; indexes: Set<string>; records: Map<string, any> }>;
    }
  >();

  let putCount = 0;
  let getCallCount = 0;

  const factory: IDBFactory & {
    __inspectStore: (storeName?: string) => Map<string, any>;
    __getPutCount: () => number;
    __getGetCallCount: () => number;
  } = {
    cmp: (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0),
    databases: async () =>
      Array.from(databases.entries()).map(([name, db]) => ({ name, version: db.version })),
    deleteDatabase: (name: string) => {
      databases.delete(name);
      const req: any = { result: undefined, error: null, onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req as IDBOpenDBRequest;
    },
    open: (name: string, version = 1) => {
      const req: any = {
        result: null,
        error: null,
        transaction: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      };

      queueMicrotask(() => {
        if (options.simulateBlockedOpen) {
          req.onblocked?.({ target: req });
          return;
        }
        if (options.simulateOpenError) {
          req.error = new Error('Simulated IDB open error');
          req.onerror?.({ target: req });
          return;
        }

        let dbEntry = databases.get(name);
        const needsUpgrade = !dbEntry || dbEntry.version < version;
        if (!dbEntry) {
          dbEntry = { version, stores: new Map() };
          databases.set(name, dbEntry);
        } else if (needsUpgrade) {
          dbEntry.version = version;
        }

        const createObjectStoreWrapper = (storeName: string, tx?: any) => {
          const storeData = dbEntry!.stores.get(storeName);
          if (!storeData) {
            throw new Error(`ObjectStore ${storeName} not found`);
          }

          const indexNames = {
            contains: (idxName: string) => storeData.indexes.has(idxName),
            length: storeData.indexes.size,
            item: (i: number) => Array.from(storeData.indexes)[i] ?? null,
          };

          return {
            name: storeName,
            keyPath: storeData.keyPath,
            indexNames,
            createIndex: (idxName: string) => {
              storeData.indexes.add(idxName);
              return {} as IDBIndex;
            },
            get: (key: string) => {
              getCallCount++;
              const getReq: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                if (options.simulateGetError) {
                  getReq.error = new Error('Simulated get error');
                  getReq.onerror?.({ target: getReq });
                  tx?.onerror?.({ target: tx });
                  return;
                }
                const found = storeData.records.get(key);
                getReq.result = found !== undefined ? structuredClone(found) : undefined;
                getReq.onsuccess?.({ target: getReq });
              });
              return getReq as IDBRequest;
            },
            getAll: () => {
              const allReq: any = { result: [], error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                allReq.result = Array.from(storeData.records.values()).map((v) => structuredClone(v));
                allReq.onsuccess?.({ target: allReq });
              });
              return allReq as IDBRequest;
            },
            put: (value: any) => {
              putCount++;
              const putReq: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              if (options.quotaExceededOnNthPut && putCount === options.quotaExceededOnNthPut) {
                const quotaErr = new Error('The quota has been exceeded.');
                quotaErr.name = 'QuotaExceededError';
                queueMicrotask(() => {
                  putReq.error = quotaErr;
                  putReq.onerror?.({ target: putReq });
                  if (tx) {
                    tx.error = quotaErr;
                    tx._aborted = true;
                    tx.onabort?.({ target: tx });
                  }
                });
                return putReq as IDBRequest;
              }

              const cloned = structuredClone(value);
              const primaryKey = cloned[storeData.keyPath];
              storeData.records.set(String(primaryKey), cloned);
              queueMicrotask(() => {
                putReq.result = primaryKey;
                putReq.onsuccess?.({ target: putReq });
              });
              return putReq as IDBRequest;
            },
            delete: (key: string) => {
              const delReq: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              storeData.records.delete(String(key));
              queueMicrotask(() => {
                delReq.onsuccess?.({ target: delReq });
              });
              return delReq as IDBRequest;
            },
            clear: () => {
              const clearReq: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              storeData.records.clear();
              queueMicrotask(() => {
                clearReq.onsuccess?.({ target: clearReq });
              });
              return clearReq as IDBRequest;
            },
          };
        };

        const dbInstance: any = {
          name,
          version: dbEntry.version,
          onversionchange: null,
          onclose: null,
          objectStoreNames: {
            contains: (sName: string) => dbEntry!.stores.has(sName),
            length: dbEntry.stores.size,
            item: (i: number) => Array.from(dbEntry!.stores.keys())[i] ?? null,
          },
          createObjectStore: (sName: string, opts?: { keyPath?: string }) => {
            const keyPath = opts?.keyPath || 'id';
            dbEntry!.stores.set(sName, {
              keyPath,
              indexes: new Set(),
              records: new Map(),
            });
            return createObjectStoreWrapper(sName);
          },
          transaction: (storeName: string | string[], mode: IDBTransactionMode = 'readonly') => {
            const targetStore = Array.isArray(storeName) ? storeName[0] : storeName;
            const tx: any = {
              mode,
              error: null,
              _aborted: false,
              oncomplete: null,
              onerror: null,
              onabort: null,
              objectStore: (sName: string) => createObjectStoreWrapper(sName || targetStore, tx),
            };
            // Schedule transaction completion after microtasks queued by store operations
            setTimeout(() => {
              if (!tx._aborted) {
                tx.oncomplete?.({ target: tx });
              }
            }, 2);
            return tx as IDBTransaction;
          },
          close: () => {
            dbInstance.onclose?.();
          },
        };

        req.result = dbInstance;
        if (needsUpgrade) {
          req.transaction = {
            objectStore: (sName: string) => createObjectStoreWrapper(sName),
          };
          req.onupgradeneeded?.({ target: req });
          req.transaction = null;
        }
        req.onsuccess?.({ target: req });
      });

      return req as IDBOpenDBRequest;
    },
    __inspectStore: (storeName = CACHE_STORE_NAME) => {
      const db = databases.get(CACHE_DB_NAME);
      return db?.stores.get(storeName)?.records ?? new Map();
    },
    __getPutCount: () => putCount,
    __getGetCallCount: () => getCallCount,
  };

  return factory;
}

test('IndexedDB wrapper: set, get, delete, clearNamespace, clearAll, and namespace isolation', async () => {
  const idb = createMockIdbFactory();
  let currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });

  // Set same key across all 4 namespaces
  const namespaces: CacheNamespace[] = ['tmdb', 'anilist', 'tvdb', 'fribb'];
  for (const ns of namespaces) {
    const written = await indexedDbCache.set(ns, 'shared_key', { provider: ns, count: 42 });
    assert.equal(written, true);
  }

  // Verify namespace isolation
  for (const ns of namespaces) {
    const hit = await indexedDbCache.get<{ provider: string; count: number }>(ns, 'shared_key');
    assert.ok(hit);
    assert.equal(hit.status, 'fresh');
    assert.deepEqual(hit.value, { provider: ns, count: 42 });
    assert.equal(hit.record.namespace, ns);
    assert.equal(hit.record.key, 'shared_key');
    assert.equal(hit.record.schemaVersion, CACHE_SCHEMA_VERSION);
  }

  // Delete single entry in tmdb without affecting anilist/tvdb/fribb
  const deleted = await indexedDbCache.delete('tmdb', 'shared_key');
  assert.equal(deleted, true);
  assert.equal(await indexedDbCache.get('tmdb', 'shared_key'), null);
  assert.ok(await indexedDbCache.get('anilist', 'shared_key'));

  // Clear single namespace
  await indexedDbCache.clearNamespace('anilist');
  assert.equal(await indexedDbCache.get('anilist', 'shared_key'), null);
  assert.ok(await indexedDbCache.get('tvdb', 'shared_key'));
  assert.ok(await indexedDbCache.get('fribb', 'shared_key'));

  // Clear all
  await indexedDbCache.clearAll();
  assert.equal(await indexedDbCache.get('tvdb', 'shared_key'), null);
  assert.equal(await indexedDbCache.get('fribb', 'shared_key'), null);
});

test('IndexedDB wrapper: fresh TTL, stale window, and hard expiration policies per namespace', async () => {
  const idb = createMockIdbFactory();
  let currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  // Verify configured default policies match Stage 3D specification
  assert.equal(CACHE_NAMESPACE_POLICIES.tmdb.freshTtlMs, 6 * HOUR);
  assert.equal(CACHE_NAMESPACE_POLICIES.tmdb.staleWindowMs, 24 * HOUR);
  assert.equal(CACHE_NAMESPACE_POLICIES.anilist.freshTtlMs, 6 * HOUR);
  assert.equal(CACHE_NAMESPACE_POLICIES.anilist.staleWindowMs, 24 * HOUR);
  assert.equal(CACHE_NAMESPACE_POLICIES.tvdb.freshTtlMs, 12 * HOUR);
  assert.equal(CACHE_NAMESPACE_POLICIES.tvdb.staleWindowMs, 48 * HOUR);
  assert.equal(CACHE_NAMESPACE_POLICIES.fribb.freshTtlMs, 24 * HOUR);
  assert.equal(CACHE_NAMESPACE_POLICIES.fribb.staleWindowMs, 7 * DAY);

  await indexedDbCache.set('tmdb', 'movie_1', { id: 1, title: 'Fresh Movie' });

  // At +5h59m -> still fresh
  currentNow += 6 * HOUR - 1000;
  const freshHit = await indexedDbCache.get('tmdb', 'movie_1');
  assert.ok(freshHit);
  assert.equal(freshHit.status, 'fresh');

  // At +6h01m -> stale (within 24h stale window)
  currentNow += 2000;
  const staleHit = await indexedDbCache.get('tmdb', 'movie_1');
  assert.ok(staleHit);
  assert.equal(staleHit.status, 'stale');
  assert.deepEqual(staleHit.value, { id: 1, title: 'Fresh Movie' });

  // At +24h01m -> hard expired (returns null and deletes record)
  currentNow += 18 * HOUR + 2000;
  const expiredHit = await indexedDbCache.get('tmdb', 'movie_1');
  assert.equal(expiredHit, null);

  // Wait for async deletion transaction to complete
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(idb.__inspectStore().has(buildCacheRecordId('tmdb', 'movie_1')), false);
});

test('IndexedDB wrapper: LRU eviction, max entry count, and max byte size enforcement', async () => {
  const idb = createMockIdbFactory();
  let currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
    maxEntries: 3,
    maxBytes: 100_000,
    maintenanceWriteInterval: 100, // trigger maintenance explicitly for deterministic assertions
  });

  // Insert 4 entries with advancing timestamps
  await indexedDbCache.set('tmdb', 'k1', { idx: 1 });
  currentNow += 1000;
  await indexedDbCache.set('tmdb', 'k2', { idx: 2 });
  currentNow += 1000;
  await indexedDbCache.set('tmdb', 'k3', { idx: 3 });
  currentNow += 1000;

  // Touch k1 so k2 becomes the least-recently-used entry
  const k1Touch = await indexedDbCache.get('tmdb', 'k1');
  assert.ok(k1Touch);
  await new Promise((r) => setTimeout(r, 10));

  currentNow += 1000;
  await indexedDbCache.set('tmdb', 'k4', { idx: 4 });
  await indexedDbCache.runMaintenance();

  const statsAfterCountEviction = await indexedDbCache.getStats();
  assert.equal(statsAfterCountEviction.totalEntries, 3);
  assert.equal(await indexedDbCache.get('tmdb', 'k2'), null, 'k2 (oldest accessed) should be evicted first');
  assert.ok(await indexedDbCache.get('tmdb', 'k1'), 'k1 (recently touched) should be retained');
  assert.ok(await indexedDbCache.get('tmdb', 'k3'));
  assert.ok(await indexedDbCache.get('tmdb', 'k4'));

  // Now enforce a tight byte limit so larger entries evict older entries
  const singlePayload = { text: 'x'.repeat(200) }; // ~540 bytes + 128 overhead
  const singleBytes = estimateApproxBytes(singlePayload) + 128;
  indexedDbCache.configure({
    maxEntries: 50,
    maxBytes: singleBytes * 2 + 50, // room for at most 2 such entries
  });

  await indexedDbCache.clearAll();
  currentNow += 1000;
  await indexedDbCache.set('anilist', 'b1', singlePayload);
  currentNow += 1000;
  await indexedDbCache.set('anilist', 'b2', singlePayload);
  currentNow += 1000;
  await indexedDbCache.set('anilist', 'b3', singlePayload);
  await indexedDbCache.runMaintenance();

  const statsAfterByteEviction = await indexedDbCache.getStats();
  assert.equal(statsAfterByteEviction.totalEntries, 2);
  assert.ok(statsAfterByteEviction.totalApproxBytes <= singleBytes * 2 + 50);
  assert.equal(await indexedDbCache.get('anilist', 'b1'), null, 'Oldest entry b1 evicted to meet byte budget');
  assert.ok(await indexedDbCache.get('anilist', 'b2'));
  assert.ok(await indexedDbCache.get('anilist', 'b3'));

  // Single entry exceeding entire maxBytes budget is rejected immediately
  const hugeWritten = await indexedDbCache.set('anilist', 'too_big', { text: 'y'.repeat(10_000) });
  assert.equal(hugeWritten, false);
});

test('IndexedDB wrapper: corrupted record rejection, schema version mismatch, and custom validator', async () => {
  const idb = createMockIdbFactory();
  const currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });

  await indexedDbCache.set('tmdb', 'valid_entry', { id: 100 });
  const rawStore = idb.__inspectStore();

  // Inject a record with mismatched schemaVersion
  rawStore.set('tmdb:bad_schema', {
    id: 'tmdb:bad_schema',
    key: 'bad_schema',
    namespace: 'tmdb',
    schemaVersion: 999,
    value: { id: 101 },
    createdAt: currentNow,
    updatedAt: currentNow,
    expiresAt: currentNow + 60_000,
    staleUntil: currentNow + 120_000,
    lastAccessedAt: currentNow,
    approxBytes: 120,
  });

  // Inject a malformed record missing timestamps
  rawStore.set('tmdb:corrupted', {
    id: 'tmdb:corrupted',
    key: 'corrupted',
    namespace: 'tmdb',
    schemaVersion: CACHE_SCHEMA_VERSION,
    value: { broken: true },
  });

  assert.equal(await indexedDbCache.get('tmdb', 'bad_schema'), null);
  assert.equal(await indexedDbCache.get('tmdb', 'corrupted'), null);

  // Custom read validator rejects invalid shape and deletes entry
  const rejectedByValidator = await indexedDbCache.get<{ id: number }>('tmdb', 'valid_entry', {
    validate: (val) => val.id === 999,
  });
  assert.equal(rejectedByValidator, null);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(rawStore.has('tmdb:valid_entry'), false);
});

test('IndexedDB wrapper: graceful fallback when indexedDB is unavailable, blocked, errors, or hits QuotaExceededError', async () => {
  // 1. indexedDB unavailable (null)
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({ idbFactory: null });
  assert.equal(indexedDbCache.isAvailable(), false);
  assert.equal(await indexedDbCache.set('tmdb', 'k', { a: 1 }), false);
  assert.equal(await indexedDbCache.get('tmdb', 'k'), null);
  assert.equal(await indexedDbCache.delete('tmdb', 'k'), false);

  // 2. Blocked open
  const blockedIdb = createMockIdbFactory({ simulateBlockedOpen: true });
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({ idbFactory: blockedIdb });
  assert.equal(await indexedDbCache.get('tmdb', 'k'), null);
  assert.equal(await indexedDbCache.set('tmdb', 'k', { a: 1 }), false);

  // 3. Transaction get error
  const getErrorIdb = createMockIdbFactory({ simulateGetError: true });
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({ idbFactory: getErrorIdb });
  assert.equal(await indexedDbCache.get('tmdb', 'k'), null);

  // 4. QuotaExceededError on put triggers maintenance eviction and retries once
  const quotaIdb = createMockIdbFactory({ quotaExceededOnNthPut: 2 });
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({ idbFactory: quotaIdb });
  assert.equal(await indexedDbCache.set('tmdb', 'seed', { a: 1 }), true);
  // 2nd put triggers QuotaExceededError, runs maintenance, and retries (3rd put succeeds)
  assert.equal(await indexedDbCache.set('tmdb', 'after_quota', { a: 2 }), true);
  const recovered = await indexedDbCache.get<{ a: number }>('tmdb', 'after_quota');
  assert.ok(recovered);
  assert.deepEqual(recovered.value, { a: 2 });
});

test('IndexedDB wrapper: concurrent read deduplication and protection against older out-of-order writes', async () => {
  const idb = createMockIdbFactory();
  const currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });

  await indexedDbCache.set('tmdb', 'race_key', { version: 'newer' }, { updatedAt: 2000 });
  const olderWriteAccepted = await indexedDbCache.set(
    'tmdb',
    'race_key',
    { version: 'older_stale_response' },
    { updatedAt: 1500 }
  );
  assert.equal(olderWriteAccepted, false);

  // Concurrent gets for the same key share a single IDB store.get request
  const beforeGets = idb.__getGetCallCount();
  const [r1, r2, r3] = await Promise.all([
    indexedDbCache.get<{ version: string }>('tmdb', 'race_key', { touchOnRead: false }),
    indexedDbCache.get<{ version: string }>('tmdb', 'race_key', { touchOnRead: false }),
    indexedDbCache.get<{ version: string }>('tmdb', 'race_key', { touchOnRead: false }),
  ]);
  const afterGets = idb.__getGetCallCount();
  assert.equal(afterGets - beforeGets, 1, 'Concurrent gets for same key should deduplicate into 1 IDB read');
  assert.deepEqual(r1?.value, { version: 'newer' });
  assert.deepEqual(r2?.value, { version: 'newer' });
  assert.deepEqual(r3?.value, { version: 'newer' });
});

test('Fribb L2 IndexedDB integration: fresh cache hit avoids network, stale cache serves immediately and refreshes in background, invalid cache falls back to network', async () => {
  const idb = createMockIdbFactory();
  let currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });
  resetFribbClientCache();

  const originalFetch = globalThis.fetch;
  let networkFetchCount = 0;

  try {
    // 1. Seed fresh Fribb dataset in IndexedDB
    await indexedDbCache.set('fribb', FRIBB_CACHE_KEY, [
      {
        anilist_id: 777001,
        mal_id: 77701,
        tvdb_id: 888001,
        themoviedb_id: { tv: 999001 },
        type: 'TV',
      },
    ]);

    globalThis.fetch = (async () => {
      networkFetchCount++;
      throw new Error('Network should not be called on fresh Fribb IndexedDB hit');
    }) as typeof fetch;

    const mapped = await resolveAnimeMapping(777001);
    assert.equal(networkFetchCount, 0);
    assert.equal(mapped.mappingFound, true);
    assert.equal(mapped.tmdbTvId, 999001);
    assert.equal(mapped.tvdbId, 888001);

    // 2. Advance clock past 24h fresh TTL (e.g., +30 hours, within 7-day stale window)
    resetFribbClientCache();
    currentNow += 30 * 60 * 60 * 1000;

    globalThis.fetch = (async () => {
      networkFetchCount++;
      return new Response(
        JSON.stringify([
          {
            anilist_id: 777001,
            mal_id: 77701,
            tvdb_id: 888002,
            themoviedb_id: { tv: 999002 },
            type: 'TV',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    // Stale hit returns immediately with cached mapping while triggering background refresh
    const staleMapped = await resolveAnimeMapping(777001);
    assert.equal(staleMapped.mappingFound, true);

    // Wait for background refresh to complete
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(networkFetchCount, 1);
    const refreshedMapped = await resolveAnimeMapping(777001);
    assert.equal(refreshedMapped.tmdbTvId, 999002);
    assert.equal(refreshedMapped.tvdbId, 888002);

    // 3. Corrupted Fribb dataset in IndexedDB falls back to network fetch
    resetFribbClientCache();
    idb.__inspectStore().set(buildCacheRecordId('fribb', FRIBB_CACHE_KEY), {
      id: buildCacheRecordId('fribb', FRIBB_CACHE_KEY),
      key: FRIBB_CACHE_KEY,
      namespace: 'fribb',
      schemaVersion: CACHE_SCHEMA_VERSION,
      value: [{ invalid_entry_without_anilist_id: true }],
      createdAt: currentNow,
      updatedAt: currentNow,
      expiresAt: currentNow + 100_000,
      staleUntil: currentNow + 200_000,
      lastAccessedAt: currentNow,
      approxBytes: 120,
    });

    await preloadFribbMapping();
    assert.equal(networkFetchCount, 2, 'Corrupted Fribb cache should fall back to network fetch');
  } finally {
    globalThis.fetch = originalFetch;
    resetFribbClientCache();
  }
});

test('TVDB L2 IndexedDB integration: caches valid episode lists across memory reset and never caches empty episode arrays or failed responses', async () => {
  const idb = createMockIdbFactory();
  const currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });
  resetTvdbClientCache();

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    // 1. Empty episodes array response must NOT be persisted in L1 or L2 IndexedDB
    globalThis.fetch = (async () => {
      fetchCalls++;
      return new Response(
        JSON.stringify({ status: 'success', data: { episodes: [] }, links: { next: null } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const emptyResult = await fetchTVDBEpisodesForSeries(403816);
    assert.deepEqual(emptyResult, []);
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(
      await indexedDbCache.get('tvdb', `${TVDB_EPISODES_CACHE_PREFIX}403816`),
      null,
      'Empty TVDB episode arrays must never be persisted to IndexedDB'
    );

    // 2. Non-empty episode list is persisted to L2 and hydrated when L1 memory is cleared
    globalThis.fetch = (async () => {
      fetchCalls++;
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            episodes: [
              { id: 901, seasonNumber: 1, number: 1, name: 'Operation Strix', image: '/ep1.jpg' },
            ],
          },
          links: { next: null, total_items: 1, page_size: 500 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const firstFetch = await fetchTVDBEpisodesForSeries(403816);
    assert.equal(firstFetch.length, 1);
    assert.equal(fetchCalls, 2);
    await new Promise((r) => setTimeout(r, 15));

    // Clear L1 memory cache to simulate browser reload; next call must hit L2 IndexedDB with 0 network fetches
    resetTvdbClientCache();
    const secondFetchFromIdb = await fetchTVDBEpisodesForSeries(403816);
    assert.equal(fetchCalls, 2, 'Should serve TVDB episodes from L2 IndexedDB after L1 reset');
    assert.equal(secondFetchFromIdb.length, 1);
    assert.equal(secondFetchFromIdb[0].name, 'Operation Strix');
  } finally {
    globalThis.fetch = originalFetch;
    resetTvdbClientCache();
  }
});

test('AniList L2 IndexedDB integration: persists catalog queries, skips ephemeral search persistence, and never persists GraphQL errors or HTTP 500s', async () => {
  const idb = createMockIdbFactory();
  const currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });
  resetAnilistClientCache();

  const originalFetch = globalThis.fetch;
  let anilistNetworkCalls = 0;

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/anilist')) {
        anilistNetworkCalls++;
        if (url.includes('op=trending')) {
          return new Response(
            JSON.stringify({
              data: {
                Page: {
                  media: [
                    {
                      id: 140960,
                      title: { english: 'SPY x FAMILY', romaji: 'SPY x FAMILY' },
                      coverImage: { extraLarge: 'https://img.anilist.co/spy.jpg' },
                      bannerImage: 'https://img.anilist.co/spy-banner.jpg',
                      genres: ['Action', 'Comedy'],
                      averageScore: 86,
                      format: 'TV',
                    },
                  ],
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('op=search')) {
          return new Response(
            JSON.stringify({
              data: {
                Page: {
                  media: [
                    {
                      id: 21,
                      title: { english: 'ONE PIECE', romaji: 'ONE PIECE' },
                      coverImage: { extraLarge: 'https://img.anilist.co/op.jpg' },
                      genres: ['Action'],
                      averageScore: 88,
                      format: 'TV',
                    },
                  ],
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      return new Response(JSON.stringify({ results: [], logos: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const trending1 = await fetchTrendingAnime(10);
    assert.equal(trending1.results.length, 1);
    assert.equal(anilistNetworkCalls, 1);
    await new Promise((r) => setTimeout(r, 15));

    // Clear L1 memory; trending catalog query should hit L2 IndexedDB without calling network
    resetAnilistClientCache();
    const trending2 = await fetchTrendingAnime(10);
    assert.equal(trending2.results.length, 1);
    assert.equal(anilistNetworkCalls, 1, 'AniList trending should be served from L2 IndexedDB');

    // Ephemeral search query should NOT be persisted in L2 IndexedDB
    await searchAnime('One Piece');
    await new Promise((r) => setTimeout(r, 15));
    const searchCacheKey = `${ANILIST_SESSION_CACHE_PREFIX}op=search&page=1&perPage=20&search=One+Piece`;
    assert.equal(
      await indexedDbCache.get('anilist', searchCacheKey),
      null,
      'Ephemeral AniList search queries must not be persisted to L2 IndexedDB'
    );
  } finally {
    globalThis.fetch = originalFetch;
    resetAnilistClientCache();
  }
});

test('TMDB L2 IndexedDB integration: persists catalog/details/person data, hydrates synchronous L1 getters, and never persists failed responses', async () => {
  const idb = createMockIdbFactory();
  const currentNow = 1_700_000_000_000;
  indexedDbCache.resetRuntimeState();
  indexedDbCache.configure({
    idbFactory: idb,
    now: () => currentNow,
  });
  resetTmdbClientCache();

  const originalFetch = globalThis.fetch;
  let tmdbNetworkCalls = 0;

  try {
    // 1. Failed response (500) on fetchTrending must NOT be cached in L1 or L2
    globalThis.fetch = (async () => {
      tmdbNetworkCalls++;
      return new Response(JSON.stringify({ error: { message: 'Upstream failure' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const failedTrending = await fetchTrending();
    assert.deepEqual(failedTrending, { results: [] });
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(
      await indexedDbCache.get('tmdb', 'trending_all_day'),
      null,
      'Failed TMDB responses must never be persisted to IndexedDB'
    );

    // 2. Successful fetchDetails, fetchPersonDetails, and fetchPersonCombinedCredits persist to L2 and hydrate synchronous L1 getters
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      tmdbNetworkCalls++;
      if (url.startsWith('/api/tmdb/movie/550')) {
        return new Response(
          JSON.stringify({
            id: 550,
            title: 'Fight Club',
            media_type: 'movie',
            images: {
              logos: [{ iso_639_1: 'en', file_path: '/fight_club_logo.png', vote_average: 9 }],
            },
            videos: {
              results: [{ site: 'YouTube', type: 'Trailer', official: true, key: 'qtRKdVHc-cE' }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/tmdb/person/287/combined_credits')) {
        return new Response(
          JSON.stringify({
            cast: [
              {
                id: 550,
                media_type: 'movie',
                title: 'Fight Club',
                poster_path: '/fc_poster.jpg',
                character: 'Tyler Durden',
                popularity: 85,
                vote_average: 8.4,
                vote_count: 25000,
                release_date: '1999-10-15',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/tmdb/person/287')) {
        return new Response(
          JSON.stringify({
            id: 287,
            name: 'Brad Pitt',
            biography: 'Actor and producer.',
            profile_path: '/brad.jpg',
            known_for_department: 'Acting',
            popularity: 75,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as typeof fetch;

    const details1 = await fetchDetails(550, 'movie');
    const person1 = await fetchPersonDetails(287);
    const credits1 = await fetchPersonCombinedCredits(287);
    assert.equal(details1.title, 'Fight Club');
    assert.equal(person1.name, 'Brad Pitt');
    assert.equal(credits1.length, 1);
    await new Promise((r) => setTimeout(r, 20));

    // Reset L1 memory cache to simulate a fresh page load; L2 IndexedDB should serve all 3 and hydrate synchronous getters
    resetTmdbClientCache();
    assert.equal(getSeedItem('movie', 550), null);
    assert.equal(getCachedPersonDetails(287), null);
    assert.equal(getCachedPersonCombinedCredits(287), null);

    const callsBeforeReload = tmdbNetworkCalls;
    const detailsFromL2 = await fetchDetails(550, 'movie');
    const personFromL2 = await fetchPersonDetails(287);
    const creditsFromL2 = await fetchPersonCombinedCredits(287);

    assert.equal(tmdbNetworkCalls, callsBeforeReload, 'All 3 calls should hit L2 IndexedDB with 0 network requests');
    assert.equal(detailsFromL2.title, 'Fight Club');
    assert.equal(personFromL2.name, 'Brad Pitt');
    assert.equal(creditsFromL2.length, 1);

    // Verify synchronous L1 getters are now hydrated from the L2 IndexedDB read
    assert.equal(getSeedItem('movie', 550)?.title, 'Fight Club');
    assert.equal(hasCachedLogoEntry({ id: 550, media_type: 'movie' }), true);
    assert.equal(
      getCachedLogo({ id: 550, media_type: 'movie' }),
      'https://image.tmdb.org/t/p/w500/fight_club_logo.png'
    );
    assert.equal(getCachedPersonDetails(287)?.name, 'Brad Pitt');
    assert.equal(getCachedPersonCombinedCredits(287)?.[0]?.character, 'Tyler Durden');
  } finally {
    globalThis.fetch = originalFetch;
    resetTmdbClientCache();
    indexedDbCache.resetRuntimeState();
  }
});
