# Time Rich portal UI redesign

Approved standalone design preview covering dashboard, curriculum, live sessions, resources, prompts, and members. Preserves the cream, sage, olive and lime palette and adds responsive navigation, a day/night switch, Stanley branding, smooth accordions, and a circular completion meter.

Run from the repository root with `python -m http.server 8082`, then open `http://127.0.0.1:8082/dashboard-redesign/preview.html`.

Preview pages use sample content and do not write to member accounts. The other HTML pages are integration candidates based on the earlier live source. The repository's current `portal/` has newer changes and remains unchanged; reconcile candidates with that source before deploying. JavaScript dependencies here are isolated copies for preview compatibility. Do not replace current authentication or data handlers wholesale.

No production deployment is included in this branch.
