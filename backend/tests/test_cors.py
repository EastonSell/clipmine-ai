from fastapi.testclient import TestClient

from clipmine_api.main import app


def test_healthcheck_allows_localhost_origin() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_healthcheck_allows_loopback_origin() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health", headers={"Origin": "http://127.0.0.1:3000"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
