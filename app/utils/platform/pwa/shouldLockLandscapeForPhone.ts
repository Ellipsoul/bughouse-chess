/**
 * Decide whether the PWA should request a landscape-only orientation lock via the Web App Manifest.
 *
 * Important limitations:
 * - The Web App Manifest only supports a single `orientation` value; it cannot be targeted to "phones only"
 *   in a standards-based way. We approximate "phone" using the User-Agent string.
 * - In practice this is most useful on Android/Chromium-installed PWAs. iOS Safari has limited/variable
 *   support for manifest orientation locking.
 *
 * Heuristic:
 * - Android phones: User-Agent contains both "Android" and "Mobile"
 * - Android tablets: usually "Android" but NOT "Mobile"
 * - iPad: contains "iPad" (or sometimes reports as "Macintosh" with iPadOS quirks; we don't try to detect
 *   that here)
 *
 * @param userAgent - The request's `User-Agent` header value.
 * @returns True if we should include `orientation: "landscape"` in the manifest for this request.
 */
export function shouldLockLandscapeForPhone(userAgent: string | null): boolean {
  if (!userAgent) return false;

  // Android is the only reliably-targetable platform for this.
  const isAndroid = /Android/i.test(userAgent);
  if (!isAndroid) return false;

  // On Android, presence of "Mobile" strongly correlates with phones.
  const isAndroidPhone = /Mobile/i.test(userAgent);
  return isAndroidPhone;
}
