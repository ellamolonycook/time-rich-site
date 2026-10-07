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
  // Worker route that mints a 5-minute signed URL for a gated skill download.
  // It re-checks the passcode and the week's release date server side; the
  // browser never sees the Storage bucket or any service key.
  downloadUrl: "https://time-rich-forms.timerich.workers.dev/portal-download",
  url: "https://hmnqnkchwmxkwchqvxyj.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtbnFua2Nod214a3djaHF2eHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTIxNjksImV4cCI6MjEwNjUyODE2OX0.iUwxKM7jb7j0hrJ1CC22aMRcB2l9CsZGwYcmT2ng1Kc"
};
