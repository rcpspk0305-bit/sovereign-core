"""Tests for health and diagnostics endpoint."""

from fastapi.testclient import TestClient


def test_health_check_endpoint(test_client: TestClient):
    response = test_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["ollama_connected"] is True
    assert "ollama_url" in data


def test_root_endpoint(test_client: TestClient):
    response = test_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Sovereign-Core AI Workbench"
    assert data["status"] == "online"
