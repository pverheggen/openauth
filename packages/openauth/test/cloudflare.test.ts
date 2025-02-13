import { afterEach, setSystemTime } from "bun:test"
import { beforeEach, describe, expect, test, mock } from "bun:test"
import {
  CloudflareStorage,
  CloudflareStorageOptions,
} from "../src/storage/cloudflare.js"

const options = {
  namespace: {
    put: mock(),
    getWithMetadata: mock(),
  },
}
const storage = CloudflareStorage(
  options as unknown as CloudflareStorageOptions,
)

beforeEach(async () => {
  setSystemTime(new Date("1/1/2024"))
})

afterEach(() => {
  setSystemTime()
  options.namespace.put.mockReset()
  options.namespace.getWithMetadata.mockReset()
})

describe("set", () => {
  test("less than 60", async () => {
    const expiry = new Date()
    expiry.setTime(Date.now() + 16 * 1000)
    await storage.set(["users", "123"], { name: "Test User" }, expiry)
    expect(options.namespace.put).toHaveBeenCalledWith(
      expect.anything(),
      JSON.stringify({ name: "Test User" }),
      {
        expirationTtl: 60,
        metadata: {
          expiry: expiry.getTime(),
        },
      },
    )
  })

  test("more than 60", async () => {
    const expiry = new Date()
    expiry.setTime(Date.now() + 61 * 1000)
    await storage.set(["users", "123"], { name: "Test User" }, expiry)
    const result = await storage.get(["users", "123"])
    expect(options.namespace.put).toHaveBeenCalledWith(
      expect.anything(),
      JSON.stringify({ name: "Test User" }),
      {
        expirationTtl: 61,
      },
    )
  })
})

describe("get", () => {
  test("less than 60", async () => {
    options.namespace.getWithMetadata.mockResolvedValue({
      value: { name: "Test User" },
      metadata: {
        expiry: Date.now() + 500,
      },
    })
    const result = await storage.get(["users", "123"])
    expect(result).toEqual({ name: "Test User" })
  })

  test("less than 60 and expired", async () => {
    options.namespace.getWithMetadata.mockResolvedValue({
      value: { name: "Test User" },
      metadata: {
        expiry: Date.now() - 500,
      },
    })
    const result = await storage.get(["users", "123"])
    expect(result).not.toBeDefined()
  })

  test("more than 60", async () => {
    options.namespace.getWithMetadata.mockResolvedValue({
      value: { name: "Test User" },
    })
    const result = await storage.get(["users", "123"])
    expect(result).toEqual({ name: "Test User" })
  })

  test("expired or not exists", async () => {
    options.namespace.getWithMetadata.mockResolvedValue(undefined)
    const result = await storage.get(["users", "123"])
    expect(result).not.toBeDefined()
  })
})
