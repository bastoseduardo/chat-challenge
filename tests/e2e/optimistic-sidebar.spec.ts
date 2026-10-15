import { randomUUID } from "node:crypto"
import { test, expect, type Request } from "@playwright/test"

/**
 * Renomear, apagar e desfazer na sidebar acontecem no cliente, sem request
 * RSC (o "reload" que a Round 3 eliminou).
 *
 * Precisa de sessão: roda só com E2E_DEV_LOGIN=1, contra `npm run dev` com
 * DEV_LOGIN_EMAIL no .env.local (rota /auth/dev-login). Usa o banco real:
 * cria uma conversa vazia (sem chamar o modelo) e apaga no fim.
 *
 *   E2E_DEV_LOGIN=1 npx playwright test optimistic-sidebar
 */
test.skip(!process.env.E2E_DEV_LOGIN, "defina E2E_DEV_LOGIN=1 pra rodar com login de dev")

test("renomear, apagar e desfazer sem recarregar", async ({ page }) => {
  await page.goto("/auth/dev-login?next=/c/new")
  await page.waitForURL("**/c/new")

  const id = randomUUID()
  const title = `E2E ${id.slice(0, 8)}`
  expect((await page.request.post("/api/conversations", { data: { id } })).ok()).toBe(true)
  await page.request.patch(`/api/conversations/${id}`, { data: { title } })

  try {
    // Recarrega uma vez pra conversa entrar na lista; daqui pra frente nada de RSC.
    await page.reload()
    const rsc: string[] = []
    const onRequest = (r: Request) => {
      if (r.headers()["rsc"] === "1" || r.url().includes("_rsc=")) rsc.push(r.url())
    }
    page.on("request", onRequest)

    const row = page.locator('[data-sidebar="menu-item"]', {
      has: page.locator(`a[href="/c/${id}"]`),
    })
    await expect(row).toBeVisible()

    // Renomear
    const renamed = `${title} renomeada`
    await row.hover()
    await row.getByRole("button", { name: /^Opções de/ }).click()
    await page.getByRole("menuitem", { name: "Renomear" }).click()
    await page.getByRole("textbox", { name: "Novo título da conversa" }).fill(renamed)
    await page.keyboard.press("Enter")
    await expect(page.locator(`a[href="/c/${id}"]`)).toHaveText(renamed)

    // Apagar → some na hora
    const renamedRow = page.locator('[data-sidebar="menu-item"]', {
      has: page.locator(`a[href="/c/${id}"]`),
    })
    await renamedRow.hover()
    await renamedRow.getByRole("button", { name: /^Opções de/ }).click()
    await page.getByRole("menuitem", { name: "Apagar" }).click()
    await expect(page.locator(`a[href="/c/${id}"]`)).toHaveCount(0)

    // Desfazer → volta e o servidor confirma
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(page.locator(`a[href="/c/${id}"]`)).toHaveText(renamed)
    await expect.poll(async () => (await page.request.get(`/api/conversations/${id}`)).status()).toBe(200)

    page.off("request", onRequest)
    expect(rsc).toEqual([])
  } finally {
    await page.request.delete(`/api/conversations/${id}`)
  }
})
