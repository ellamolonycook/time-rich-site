"""
Time Rich landing page — local preview server.

Run it:
    python3 landing_page.py

Then open http://localhost:8000 in your browser.
Press Ctrl+C to stop.

No installs needed. This uses Python's built-in web server to serve
index.html and the Images/ and Logo/ folders from this directory.
"""

import http.server
import socketserver
import os
import webbrowser

PORT = 8000
HERE = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def end_headers(self):
        # Don't cache during local development, so edits show up on refresh.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    os.chdir(HERE)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"Time Rich is running at {url}")
        print("Press Ctrl+C to stop.")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
