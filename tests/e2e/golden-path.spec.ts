import { test, expect } from "@playwright/test"

/**
 * E2E smoke test — não autentica de verdade (requer OAuth Google real).
 * Valida que:
 *  - Rotas protegidas redirecionam pra /login
 *  - Página de login renderiza com botão Google
 *  - Share com token inválido mostra not-found
 */

test.describe("Golden path smoke", () => {
  test("/ redireciona pra /login sem sessão", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL("**/login")
    expect(page.url()).toContain("/login")
  })

  test("/login renderiza com botão Google", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText("Chat Challenge", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /continuar com google/i })
    ).toBeVisible()
  })

  test("rotas protegidas redirecionam", async ({ page }) => {
    const protectedRoutes = ["/settings", "/usage", "/admin/audit"]
    for (const route of protectedRoutes) {
      await page.goto(route)
      await page.waitForURL("**/login")
      expect(page.url()).toContain("/login")
    }
  })

  test("/share/<token-inválido> mostra not-found", async ({ page }) => {
    await page.goto("/share/token-inexistente-xxxxxxxxxxxx")
    await expect(page.getByText(/compartilhamento inválido/i)).toBeVisible()
  })
})
