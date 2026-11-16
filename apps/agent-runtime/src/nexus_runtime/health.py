"""HTTP health endpoint for the local runtime bootstrap."""

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        body = b'{"status":"ok"}'
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    with ThreadingHTTPServer(("0.0.0.0", 8000), HealthHandler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
