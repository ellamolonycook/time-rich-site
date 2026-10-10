/* Time Rich accelerator portal - connection settings.
 *
 * Every call the portal makes now goes to the Worker, not to Supabase
 * directly. That is what lets the sign-in be rate limited per IP, and it
 * keeps the member-facing pages away from the database entirely.
 *
 * Nothing in this file is a secret. Never put a service_role key, or any
 * other secret, in here.
 */
window.TR_PORTAL_CONFIG = {
  // Sign in. Email in, 30-day session token out. Rate limited per IP.
  loginUrl: "https://time-rich-forms.timerich.workers.dev/portal-login",
  // Read the portal with that token. Called on every page load.
  sessionUrl: "https://time-rich-forms.timerich.workers.dev/portal-session",
  // Sign out, so the token stops working on the server too.
  logoutUrl: "https://time-rich-forms.timerich.workers.dev/portal-logout",
  // Worker route that mints a 5-minute signed URL for a gated skill download.
  // It re-checks the session and the week's release date server side; the
  // browser never sees the Storage bucket or any service key.
  downloadUrl: "https://time-rich-forms.timerich.workers.dev/portal-download",
  // Worker route behind Time Rich Members. Re-checks the session and the
  // directory_enabled switch, and returns profiles with 1-hour photo URLs.
  directoryUrl: "https://time-rich-forms.timerich.workers.dev/portal-directory"
};
