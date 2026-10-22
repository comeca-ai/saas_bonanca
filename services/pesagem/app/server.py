"""Microserviço interno de pesagem do Bonança.

O serviço não é exposto diretamente à internet. O app Bonança envia um token
interno e o contexto autenticado da organização/usuário em cada chamada.
"""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from .service import Store
from .domain import ValidationError

ORG_RE = re.compile(r"^[A-Za-z0-9_-]{8,100}$")


def tenant_db(root: Path, organization_id: str) -> str:
    filename = hashlib.sha256(organization_id.encode("utf-8")).hexdigest()[:40] + ".sqlite3"
    root.mkdir(parents=True, exist_ok=True)
    return str(root / filename)


class Handler(BaseHTTPRequestHandler):
    server_version = "BonancaPesagem/1.0"

    def send(self, status, body, content_type="application/json; charset=utf-8"):
        raw = json.dumps(body, ensure_ascii=False, allow_nan=False).encode() if isinstance(body, (dict, list)) else body
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def context(self):
        supplied = self.headers.get("Authorization", "").removeprefix("Bearer ")
        token = self.server.service_token
        if not token or not hmac.compare_digest(supplied, token):
            raise PermissionError("Acesso interno não autorizado.")
        organization_id = self.headers.get("X-Bonanca-Organization", "")
        if not ORG_RE.fullmatch(organization_id):
            raise PermissionError("Contexto de organização ausente ou inválido.")
        return organization_id, self.headers.get("X-Bonanca-User", "bonanca-service")[:120]

    def open_store(self, organization_id, actor_id):
        store = Store(tenant_db(self.server.database_root, organization_id))
        store.actor_id = actor_id
        return store

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/health":
            return self.send(200, {"status": "ok", "service": "pesagem", "version": "1.0"})
        if not path.startswith("/api/"):
            return self.send(404, {"error": "Recurso não encontrado."})
        try:
            organization_id, actor_id = self.context()
            store = self.open_store(organization_id, actor_id)
            try:
                if path == "/api/state":
                    return self.send(200, store.state())
                if path == "/api/animal":
                    animal_id = parse_qs(urlsplit(self.path).query).get("id", [""])[0]
                    animal = store.one("animals", animal_id)
                    return self.send(200, {"animal": animal, "history": store.history(animal_id), "health": store.rows("SELECT * FROM health_events WHERE animal_id=? ORDER BY date DESC", (animal_id,))})
                if path == "/api/session":
                    session_id = parse_qs(urlsplit(self.path).query).get("id", [""])[0]
                    return self.send(200, {"session": store.one("sessions", session_id), "animals": store.session_rows(session_id)})
                return self.send(404, {"error": "Recurso não encontrado."})
            finally:
                store.close()
        except PermissionError as error:
            return self.send(401, {"error": str(error)})
        except LookupError as error:
            return self.send(404, {"error": str(error)})
        except Exception:
            return self.send(500, {"error": "Não foi possível consultar o módulo de pesagem."})

    def do_POST(self):
        if urlsplit(self.path).path != "/api/commands":
            return self.send(404, {"error": "Recurso não encontrado."})
        try:
            organization_id, actor_id = self.context()
            size = int(self.headers.get("Content-Length", "0"))
        except (PermissionError, ValueError) as error:
            return self.send(401 if isinstance(error, PermissionError) else 400, {"error": str(error)})
        if not 0 < size <= 1_100_000:
            return self.send(413, {"error": "Arquivo ou requisição muito grande."})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send(415, {"error": "Envie JSON."})
        store = self.open_store(organization_id, actor_id)
        try:
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict) or not isinstance(data.get("data", {}), dict):
                raise ValidationError("Requisição inválida.")
            result = store.command(data.get("action"), data.get("data", {}))
            return self.send(200, result)
        except (ValidationError, ValueError, TypeError, KeyError) as error:
            return self.send(422, {"error": str(error)})
        except LookupError as error:
            return self.send(404, {"error": str(error)})
        except Exception:
            return self.send(503, {"error": "Não foi possível salvar agora. Tente novamente."})
        finally:
            store.close()

    def log_message(self, _format, *_args):
        return


def make_server(database_root, service_token, host="0.0.0.0", port=8080):
    server = ThreadingHTTPServer((host, port), Handler)
    server.database_root = Path(database_root)
    server.service_token = service_token
    return server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    args = parser.parse_args()
    token = os.environ.get("PESAGEM_SERVICE_TOKEN", "")
    if len(token) < 24 or token.lower().startswith(("troque-por-", "change-me")):
        if os.environ.get("NODE_ENV") == "production":
            raise SystemExit("PESAGEM_SERVICE_TOKEN deve ser forte e não pode usar placeholder.")
        token = secrets.token_urlsafe(32)
    server = make_server(os.environ.get("PESAGEM_DB_ROOT", "/data"), token, args.host, args.port)
    print(f"[bonanca-pesagem] ouvindo em {args.host}:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
