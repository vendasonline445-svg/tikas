import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SPARequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Resolve the filesystem path for requested URL
        path = self.translate_path(self.path)

        # If the requested file exists, serve normally
        if os.path.exists(path):
            return super().do_GET()

        # Otherwise, serve the SPA entrypoint for client-side routing
        self.path = "/index.html"
        return super().do_GET()


def run(server_class=ThreadingHTTPServer, handler_class=SPARequestHandler):
    # Use port 0 to let the OS choose an available port
    server_address = ("", 0)
    httpd = server_class(server_address, handler_class)
    port = httpd.server_address[1]
    print(f"Serving at http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    run()

