import { sumTokensToday } from "./counter"

export class QuotaError extends Error {
  constructor(public scope: "user" | "global", public used: number, public cap: number) {
    super(`Quota exceeded (${scope}): ${used}/${cap} tokens today`)
  }
}

function readCap(env: string, fallback: number): number {
  const n = Number(process.env[env])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function assertWithinCaps(
  userId: string,
  estimatedTokens: number
): Promise<void> {
  const userCap = readCap("USER_DAILY_TOKEN_CAP", 100_000)
  const globalCap = readCap("GLOBAL_DAILY_TOKEN_CAP", 2_000_000)

  const [userToday, globalToday] = await Promise.all([
    sumTokensToday(userId),
    sumTokensToday(null),
  ])

  const userUsed = userToday.input + userToday.output
  const globalUsed = globalToday.input + globalToday.output

  if (userUsed + estimatedTokens > userCap) {
    throw new QuotaError("user", userUsed, userCap)
  }
  if (globalUsed + estimatedTokens > globalCap) {
    throw new QuotaError("global", globalUsed, globalCap)
  }
}

export function getCaps() {
  return {
    userDaily: readCap("USER_DAILY_TOKEN_CAP", 100_000),
    globalDaily: readCap("GLOBAL_DAILY_TOKEN_CAP", 2_000_000),
  }
}
