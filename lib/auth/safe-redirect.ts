/**
 * Destino de redirect só dentro do próprio app. Checar o prefixo não basta: o
 * parser de URL remove tab/quebra de linha ("/%09/evil.com" vira "//evil.com"),
 * então compara a origem já resolvida.
 */
export function safeRedirect(next: string | null, requestUrl: string): URL {
  const base = new URL(requestUrl)
  try {
    const target = new URL(next ?? "/", base)
    if (target.origin === base.origin) return target
  } catch {}
  return new URL("/", base)
}
