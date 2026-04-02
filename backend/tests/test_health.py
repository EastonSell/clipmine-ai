from fastapi.testclient import TestClient

from clipmine_api.main import app


def test_healthcheck() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["checks"]["storageWritable"] is True
    assert "ffmpegAvailable" in payload["checks"]
    assert "modelCacheReady" in payload["checks"]
    assert isinstance(payload["queueDepth"], int)
