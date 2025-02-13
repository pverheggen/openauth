/**
 * Configure OpenAuth to use [Cloudflare KV](https://developers.cloudflare.com/kv/) as a
 * storage adapter.
 *
 * ```ts
 * import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare"
 *
 * const storage = CloudflareStorage({
 *   namespace: "my-namespace"
 * })
 *
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
import type { KVNamespace } from "@cloudflare/workers-types"
import { joinKey, splitKey, StorageAdapter } from "./storage.js"

/**
 * Configure the Cloudflare KV store that's created.
 */
export interface CloudflareStorageOptions {
  namespace: KVNamespace
}
/**
 * Creates a Cloudflare KV store.
 * @param options - The config for the adapter.
 */
export function CloudflareStorage(
  options: CloudflareStorageOptions,
): StorageAdapter {
  return {
    async get(key: string[]) {
      const result = await options.namespace.getWithMetadata<
        Record<string, any>,
        { expiry: number }
      >(joinKey(key), "json")
      if (!result) return
      if (
        result.metadata?.expiry !== undefined &&
        result.metadata?.expiry < Date.now()
      ) {
        // no need to delete the record as it will expire on its own
        return
      }
      return result.value as Record<string, any>
    },

    async set(key: string[], value: any, expiry?: Date) {
      // KV throws an error if TTL is less than 60
      const MIN_TTL = 60
      const ttl = expiry
        ? Math.floor((expiry.getTime() - Date.now()) / 1000)
        : 0
      await options.namespace.put(
        joinKey(key),
        JSON.stringify(value),
        expiry
          ? {
              expirationTtl: Math.max(MIN_TTL, ttl),
              metadata:
                ttl < MIN_TTL ? { expiry: expiry.getTime() } : undefined,
            }
          : undefined,
      )
    },

    async remove(key: string[]) {
      await options.namespace.delete(joinKey(key))
    },

    async *scan(prefix: string[]) {
      let cursor: string | undefined
      while (true) {
        const result = await options.namespace.list({
          prefix: joinKey([...prefix, ""]),
          cursor,
        })

        for (const key of result.keys) {
          const value = await options.namespace.get(key.name, "json")
          if (value !== null) {
            yield [splitKey(key.name), value]
          }
        }
        if (result.list_complete) {
          break
        }
        cursor = result.cursor
      }
    },
  }
}
