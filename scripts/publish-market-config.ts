import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { marketConfigSchema } from "../src/server/config/market-config-schema"

async function main() {
  const args = process.argv.slice(2)
  const target = args.includes("--remote") ? "--remote" : "--local"
  const market =
    args.find((argument) => !argument.startsWith("--"))?.toUpperCase() ?? "IL"

  if (market !== "IL") {
    throw new Error(`Unsupported market "${market}".`)
  }

  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const configPath = path.resolve(
    scriptDirectory,
    `../config/market.${market.toLowerCase()}.json`
  )
  const key = `market:${market}`

  const source = await readFile(configPath, "utf8")
  const config = marketConfigSchema.parse(JSON.parse(source))

  runWrangler([
    "kv",
    "key",
    "put",
    key,
    "--binding=MARKET_CONFIG",
    target,
    "--path",
    configPath,
  ])

  const storedSource = runWrangler(
    [
      "kv",
      "key",
      "get",
      key,
      "--binding=MARKET_CONFIG",
      target,
      "--text",
    ],
    true
  )
  const storedConfig = marketConfigSchema.parse(JSON.parse(storedSource))

  if (JSON.stringify(storedConfig) !== JSON.stringify(config)) {
    throw new Error(`KV verification failed for ${key}.`)
  }

  console.log(
    `Published and verified ${key} in ${target === "--remote" ? "remote" : "local"} KV.`
  )
}

function runWrangler(arguments_: string[], captureOutput = false): string {
  const result = spawnSync("wrangler", arguments_, {
    encoding: "utf8",
    stdio: captureOutput ? ["ignore", "pipe", "inherit"] : "inherit",
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`Wrangler exited with status ${result.status}.`)
  }

  return captureOutput ? result.stdout.trim() : ""
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
