// Compares the bundle's baked-in hash against /version.json (always fresh, no-store).
// If they differ, the running bundle is stale — force a reload to pick up the new deploy.
// Loop protection: localStorage key scoped to the stale hash so a second reload attempt
// for the same old bundle is suppressed (handles iOS standalone caches that ignore no-store).
export async function checkVersion(): Promise<void> {
  const bundleHash = __BUILD_HASH__
  const reloadKey = `__vr_${bundleHash}`
  if (localStorage.getItem(reloadKey)) return // already attempted reload for this stale bundle

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 2000)
    const res = await fetch('/version.json', { cache: 'no-store', signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return // dev server or version.json not yet deployed — skip
    const { hash } = (await res.json()) as { hash: string }
    if (hash !== bundleHash) {
      localStorage.setItem(reloadKey, '1')
      window.location.reload()
    }
  } catch {
    // offline, aborted, or fetch failed — render normally
  }
}
