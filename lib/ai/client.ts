import { anthropic } from "@ai-sdk/anthropic"
import { DEFAULT_MODEL } from "./pricing"

export function getModel(id?: string) {
  return anthropic(id ?? DEFAULT_MODEL)
}
