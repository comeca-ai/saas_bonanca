import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path

from app.server import make_server


class PesagemIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.server = make_server(self.temp.name, "pesagem-integration-token-123456", "127.0.0.1", 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp.cleanup()

    def call(self, path, method="GET", payload=None, organization="organization-demo-001"):
        headers = {
            "Authorization": "Bearer pesagem-integration-token-123456",
            "X-Bonanca-Organization": organization,
            "X-Bonanca-User": "42",
        }
        body = None
        if payload is not None:
            body = json.dumps(payload)
            headers["Content-Type"] = "application/json"
        connection = HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        data = json.loads(response.read().decode())
        connection.close()
        return response.status, data

    def test_health_authentication_and_organization_isolation(self):
        connection = HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request("GET", "/api/health")
        self.assertEqual(connection.getresponse().status, 200)
        connection.close()

        connection = HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request("GET", "/api/state")
        self.assertEqual(connection.getresponse().status, 401)
        connection.close()

        status, animal = self.call("/api/commands", "POST", {"action": "animal.save", "data": {"vid": "000123", "breed": "Nelore", "sex": "macho"}})
        self.assertEqual(status, 200)
        status, session = self.call("/api/commands", "POST", {"action": "session.save", "data": {"name": "Entrada", "date": "2026-10-22", "kind": "pesagem"}})
        self.assertEqual(status, 200)
        status, _ = self.call("/api/commands", "POST", {"action": "weighing.save", "data": {"animal_id": animal["id"], "session_id": session["id"], "weight": 327.5}})
        self.assertEqual(status, 200)
        status, state = self.call("/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(state["metrics"]["count"], 1)
        self.assertEqual(state["metrics"]["weighed"], 1)
        status, other = self.call("/api/state", organization="organization-demo-002")
        self.assertEqual(status, 200)
        self.assertEqual(other["metrics"]["count"], 0)


if __name__ == "__main__":
    unittest.main()
