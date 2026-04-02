from fastapi.testclient import TestClient

from clipmine_api.main import app


def test_healthcheck() -> None:
    client = TestClient(app)
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"

