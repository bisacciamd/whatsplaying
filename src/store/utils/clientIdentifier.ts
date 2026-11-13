const CLIENT_ID_STORAGE_KEY = "whatsplaying-client-id";

/**
 * Returns a stable, per-install Plex client identifier.
 *
 * Every install must present a UNIQUE `X-Plex-Client-Identifier`. The original
 * code hard-coded the literal string "Plex-Client-Identifier" for everyone,
 * so two What's Playing instances looked like the same Plex client and fought
 * over the same subscription/command state (see upstream issue #13). We now
 * generate a UUID once and persist it in localStorage.
 */
export function getClientIdentifier(): string {
  let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `wp-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
  }
  return id;
}
