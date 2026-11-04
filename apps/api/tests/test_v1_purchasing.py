"""The purchasing v1 routes: auth rule, settings, products, research triggers, schedules.

No database here: the session maker is replaced with a fake and the accessor modules the routes
call are monkeypatched, so the tests exercise routing, validation, auth and wiring only. Modules
under ``[product_id]`` cannot be imported with dotted syntax, so they come in through importlib.
"""

import importlib
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from api.routers.api.v1._auth import require_caller
from api.routers.api.v1.products import route as products_route
from conftest import build_app
from db import engine as db_engine
from db.accessors import price_findings as finding_accessors
from db.accessors import product_schedules as schedule_accessors
from db.accessors import products as product_accessors
from db.accessors import research_runs as run_accessors
from db.accessors import user_settings as settings_accessors
from fastapi.testclient import TestClient

product_detail_route = importlib.import_module("api.routers.api.v1.products.[product_id].route")
research_route = importlib.import_module("api.routers.api.v1.products.[product_id].research.route")
schedule_route = importlib.import_module("api.routers.api.v1.products.[product_id].schedule")

USER = "user:test"
NOW = datetime(2026, 5, 12, 12, 0, tzinfo=timezone.utc)


def _product(**overrides) -> SimpleNamespace:
    base = {
        "id": uuid.uuid4(),
        "user_id": USER,
        "name": "Sony WH-1000XM5",
        "image": None,
        "image_content_type": None,
        "image_url": None,
        "source_url": "https://store.example/p/123",
        "product_url": None,
        "target_price": None,
        "currency": "EUR",
        "ai_context": None,
        "created_at": NOW,
        "updated_at": NOW,
    }
    return SimpleNamespace(**{**base, **overrides})


def _run(product_id: uuid.UUID, **overrides) -> SimpleNamespace:
    base = {
        "id": uuid.uuid4(),
        "product_id": product_id,
        "user_id": USER,
        "execution_id": "exec-1",
        "trigger": "manual",
        "status": "completed",
        "summary": "Best price 299 EUR at Store A",
        "best_price": 299.0,
        "best_store": "Store A",
        "target_met": True,
        "error": None,
        "started_at": NOW,
        "finished_at": NOW,
    }
    return SimpleNamespace(**{**base, **overrides})


def _schedule_row(product_id: uuid.UUID, **overrides) -> SimpleNamespace:
    base = {
        "id": uuid.uuid4(),
        "product_id": product_id,
        "schedule_id": f"purchasing-product-{product_id}",
        "cron_expressions": ["0 9 * * *"],
        "interval_seconds": None,
        "enabled": True,
        "updated_at": NOW,
    }
    return SimpleNamespace(**{**base, **overrides})


class _FakeSession:
    """Stands in for an AsyncSession: the maker is called, then its result, then used as a context manager."""

    def __call__(self) -> "_FakeSession":
        return self

    async def __aenter__(self) -> object:
        return SimpleNamespace()

    async def __aexit__(self, *args: object) -> None:
        pass


class _FakeSessionMaker:
    def __call__(self) -> _FakeSession:
        return _FakeSession()


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(db_engine, "get_session_maker", _FakeSessionMaker())
    app = build_app()
    app.dependency_overrides[require_caller] = lambda: USER
    return TestClient(app)


@pytest.fixture
def anon_client() -> TestClient:
    return TestClient(build_app())


def test_whoami_lives_under_beta_users_on_the_sdk_client() -> None:
    """Pins the SDK path _auth resolves the caller through: client.users does not exist."""
    from mistralai.client import Mistral

    client = Mistral(api_key="test-key")
    assert hasattr(client.beta.users, "whoami_async")


def test_v1_routes_require_a_caller(anon_client: TestClient) -> None:
    product_id = uuid.uuid4()
    for method, path in [
        ("get", "/api/v1/settings"),
        ("put", "/api/v1/settings"),
        ("get", "/api/v1/products"),
        ("post", "/api/v1/products"),
        ("get", f"/api/v1/products/{product_id}"),
        ("patch", f"/api/v1/products/{product_id}"),
        ("delete", f"/api/v1/products/{product_id}"),
        ("get", f"/api/v1/products/{product_id}/image"),
        ("get", f"/api/v1/products/{product_id}/research"),
        ("post", f"/api/v1/products/{product_id}/research"),
        ("get", f"/api/v1/products/{product_id}/schedule"),
        ("put", f"/api/v1/products/{product_id}/schedule"),
        ("delete", f"/api/v1/products/{product_id}/schedule"),
    ]:
        response = anon_client.request(method, path)
        assert response.status_code == 401, f"{method.upper()} {path}"


def test_get_settings_returns_defaults_when_none_stored(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def none_settings(session, user_id):
        assert user_id == USER
        return None

    monkeypatch.setattr(settings_accessors, "get_settings", none_settings)
    response = client.get("/api/v1/settings")
    assert response.status_code == 200
    body = response.json()
    assert body["proximity_km"] == 10.0
    assert body["currency"] == "EUR"
    assert body["location"] == ""


def test_put_settings_upserts(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    stored = SimpleNamespace(location="Berlin", latitude=52.5, longitude=13.4, proximity_km=25.0, currency="EUR", updated_at=NOW)

    async def fake_upsert(session, user_id, **fields):
        assert fields["location"] == "Berlin"
        assert fields["proximity_km"] == 25.0
        return stored

    monkeypatch.setattr(settings_accessors, "upsert_settings", fake_upsert)
    response = client.put(
        "/api/v1/settings",
        json={"location": "Berlin", "latitude": 52.5, "longitude": 13.4, "proximity_km": 25.0, "currency": "EUR"},
    )
    assert response.status_code == 200
    assert response.json()["location"] == "Berlin"


def test_put_settings_rejects_out_of_range_proximity(client: TestClient) -> None:
    response = client.put("/api/v1/settings", json={"proximity_km": 0})
    assert response.status_code == 422


def _patch_product_accessors(monkeypatch: pytest.MonkeyPatch, product: SimpleNamespace) -> None:
    async def fake_get(session, user_id, product_id):
        return product if product_id == product.id else None

    async def fake_list(session, user_id):
        return [product]

    async def fake_latest_run(session, product_id):
        return None

    async def fake_schedule(session, product_id):
        return None

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    monkeypatch.setattr(product_accessors, "list_products", fake_list)
    monkeypatch.setattr(product_accessors, "latest_run", fake_latest_run)
    monkeypatch.setattr(schedule_accessors, "get_schedule", fake_schedule)


def test_create_product_with_photo_and_research_now(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product()
    started: list[str] = []

    async def fake_create(session, user_id, **fields):
        assert fields["name"] == "Sony WH-1000XM5"
        assert fields["image"] == b"png-bytes"
        assert fields["image_content_type"] == "image/png"
        product.image = fields["image"]
        product.image_content_type = fields["image_content_type"]
        product.target_price = fields["target_price"]
        return product

    async def fake_start(product_id, user_id, trigger="manual"):
        started.append(trigger)
        return "exec-1"

    monkeypatch.setattr(product_accessors, "create_product", fake_create)
    _patch_product_accessors(monkeypatch, product)
    monkeypatch.setattr(products_route, "start_research", fake_start)

    response = client.post(
        "/api/v1/products",
        data={"name": "Sony WH-1000XM5", "source_url": "https://store.example/p/123", "target_price": "299.99", "currency": "EUR", "research_now": "true"},
        files={"image": ("photo.png", b"png-bytes", "image/png")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Sony WH-1000XM5"
    assert body["has_image"] is True
    assert body["target_price"] == 299.99
    assert started == ["manual"]

    listing = client.get("/api/v1/products")
    assert listing.status_code == 200
    assert [p["id"] for p in listing.json()] == [str(product.id)]


def test_create_product_rejects_non_image_upload(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_create(session, user_id, **fields):  # pragma: no cover - must not run
        raise AssertionError("should not persist a non-image")

    monkeypatch.setattr(product_accessors, "create_product", fake_create)
    response = client.post(
        "/api/v1/products",
        data={"name": "x"},
        files={"image": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415


def test_get_product_404_for_unknown(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def none_product(session, user_id, product_id):
        return None

    monkeypatch.setattr(product_accessors, "get_product", none_product)
    assert client.get(f"/api/v1/products/{uuid.uuid4()}").status_code == 404


def test_get_product_includes_latest_run_and_schedule(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product()
    run = _run(product.id)
    schedule = _schedule_row(product.id)

    async def fake_get(session, user_id, product_id):
        return product

    async def fake_latest_run(session, product_id):
        return run

    async def fake_schedule(session, product_id):
        return schedule

    async def fake_findings(session, run_id):
        return [SimpleNamespace(id=uuid.uuid4(), store_name="Store A", product_url="https://a.example", title="t", price=299.0, currency="EUR", in_stock=True, distance_km=2.5, notes=None, found_at=NOW)]

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    monkeypatch.setattr(product_accessors, "latest_run", fake_latest_run)
    monkeypatch.setattr(schedule_accessors, "get_schedule", fake_schedule)
    monkeypatch.setattr(finding_accessors, "list_findings_for_run", fake_findings)

    response = client.get(f"/api/v1/products/{product.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["latest_run"]["status"] == "completed"
    assert body["latest_run"]["best_price"] == 299.0
    assert body["latest_run"]["findings"][0]["store_name"] == "Store A"
    assert body["schedule"]["cron_expressions"] == ["0 9 * * *"]


def test_patch_and_delete_product(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product()

    async def fake_get(session, user_id, product_id):
        return product

    async def fake_update(session, product, fields):
        assert fields["name"] == "Renamed"
        product.name = "Renamed"
        return product

    deleted: list[uuid.UUID] = []

    async def fake_delete(session, product):
        deleted.append(product.id)

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    monkeypatch.setattr(product_accessors, "update_product", fake_update)
    monkeypatch.setattr(product_accessors, "delete_product", fake_delete)
    monkeypatch.setattr(product_accessors, "latest_run", lambda *a: _async_none())
    monkeypatch.setattr(schedule_accessors, "get_schedule", lambda *a: _async_none())

    response = client.patch(f"/api/v1/products/{product.id}", json={"name": "Renamed", "ai_context": "black, over-ear"})
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"

    response = client.delete(f"/api/v1/products/{product.id}")
    assert response.status_code == 204
    assert deleted == [product.id]


async def _async_none():
    return None


def test_get_product_image(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product(image=b"png-bytes", image_content_type="image/png")

    async def fake_get(session, user_id, product_id):
        return product

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    response = client.get(f"/api/v1/products/{product.id}/image")
    assert response.status_code == 200
    assert response.content == b"png-bytes"
    assert response.headers["content-type"] == "image/png"

    bare = _product()

    async def fake_get_bare(session, user_id, product_id):
        return bare

    monkeypatch.setattr(product_accessors, "get_product", fake_get_bare)
    assert client.get(f"/api/v1/products/{bare.id}/image").status_code == 404


def test_list_research_runs_and_trigger(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product()
    run = _run(product.id)
    started: list[tuple[str, str]] = []

    async def fake_get(session, user_id, product_id):
        return product

    async def fake_list_runs(session, product_id, limit=20):
        return [run]

    async def fake_findings(session, run_id):
        return []

    async def fake_start(product_id, user_id, trigger="manual"):
        started.append((str(product_id), trigger))
        return "exec-42"

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    monkeypatch.setattr(run_accessors, "list_runs", fake_list_runs)
    monkeypatch.setattr(finding_accessors, "list_findings_for_run", fake_findings)
    monkeypatch.setattr(research_route, "start_research", fake_start)

    response = client.get(f"/api/v1/products/{product.id}/research")
    assert response.status_code == 200
    assert response.json()[0]["summary"] == "Best price 299 EUR at Store A"

    response = client.post(f"/api/v1/products/{product.id}/research")
    assert response.status_code == 202
    assert response.json()["execution_id"] == "exec-42"
    assert started == [(str(product.id), "manual")]


def _patch_schedule_platform(monkeypatch: pytest.MonkeyPatch, calls: list[tuple]) -> None:
    async def fake_upsert(**kwargs):
        calls.append(("upsert", kwargs))

    async def fake_pause(*, schedule_id, note):
        calls.append(("pause", schedule_id))
        return True

    async def fake_resume(*, schedule_id, note):
        calls.append(("resume", schedule_id))
        return True

    monkeypatch.setattr(schedule_route, "upsert_schedule", fake_upsert)
    monkeypatch.setattr(schedule_route, "pause_schedule_if_present", fake_pause)
    monkeypatch.setattr(schedule_route, "resume_schedule_if_paused", fake_resume)


def test_put_schedule_requires_exactly_one_timing(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product()

    async def fake_get(session, user_id, product_id):
        return product

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    calls: list[tuple] = []
    _patch_schedule_platform(monkeypatch, calls)

    response = client.put(f"/api/v1/products/{product.id}/schedule", json={"cron_expressions": ["0 9 * * *"], "interval_seconds": 3600})
    assert response.status_code == 422
    response = client.put(f"/api/v1/products/{product.id}/schedule", json={})
    assert response.status_code == 422
    response = client.put(f"/api/v1/products/{product.id}/schedule", json={"cron_expressions": ["0 9 * *"]})
    assert response.status_code == 422
    assert calls == []


def test_put_and_get_and_delete_schedule(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product()
    row = _schedule_row(product.id)
    calls: list[tuple] = []

    async def fake_get(session, user_id, product_id):
        return product

    async def fake_get_row(session, product_id):
        return row

    async def fake_upsert_row(session, **fields):
        row.cron_expressions = fields["cron_expressions"]
        row.enabled = fields["enabled"]
        return row

    deleted: list[uuid.UUID] = []

    async def fake_delete_row(session, product_id):
        deleted.append(product_id)

    class _Schedules:
        async def unschedule_workflow_async(self, *, schedule_id):
            calls.append(("unschedule", schedule_id))

    class _Workflows:
        schedules = _Schedules()

    class _Client:
        workflows = _Workflows()

    async def fake_get_client():
        return _Client()

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    monkeypatch.setattr(schedule_accessors, "get_schedule", fake_get_row)
    monkeypatch.setattr(schedule_accessors, "upsert_schedule", fake_upsert_row)
    monkeypatch.setattr(schedule_accessors, "delete_schedule", fake_delete_row)
    monkeypatch.setattr(schedule_route, "get_client", fake_get_client)
    _patch_schedule_platform(monkeypatch, calls)

    response = client.put(f"/api/v1/products/{product.id}/schedule", json={"cron_expressions": ["0 9 * * *"]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schedule_id"] == f"purchasing-product-{product.id}"
    assert body["cron_expressions"] == ["0 9 * * *"]
    assert body["enabled"] is True
    upserts = [c for c in calls if c[0] == "upsert"]
    assert upserts and upserts[0][1]["input"]["trigger"] == "schedule"
    assert upserts[0][1]["cron_expressions"] == ["0 9 * * *"]

    response = client.get(f"/api/v1/products/{product.id}/schedule")
    assert response.status_code == 200

    response = client.delete(f"/api/v1/products/{product.id}/schedule")
    assert response.status_code == 204
    assert deleted == [product.id]
    assert ("unschedule", row.schedule_id) in calls


def test_get_schedule_404_when_absent(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    product = _product()

    async def fake_get(session, user_id, product_id):
        return product

    async def fake_get_row(session, product_id):
        return None

    monkeypatch.setattr(product_accessors, "get_product", fake_get)
    monkeypatch.setattr(schedule_accessors, "get_schedule", fake_get_row)
    assert client.get(f"/api/v1/products/{product.id}/schedule").status_code == 404
