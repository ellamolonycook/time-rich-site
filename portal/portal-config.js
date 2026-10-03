/* Time Rich accelerator portal - connection settings.
 *
 * `key` is the Supabase PUBLISHABLE (anon) key. It is safe in the browser:
 * every table has row level security on with no policies, so the only thing
 * this key can reach is the portal_get() function.
 *
 * Never put a service_role or any other secret key in this file.
 *
 * Paste the publishable key over the placeholder below. Until you do,
 * the portal reports itself as unavailable rather than failing oddly.
 */
window.TR_PORTAL_CONFIG = {
  url: "https://hmnqnkchwmxkwchqvxyj.supabase.co",
  key: "sb_publishable_0MQv1aTwy5Be9xzC0ITu0A_e4cc0S-t"
};
