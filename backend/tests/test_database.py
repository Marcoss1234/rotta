import database


def test_get_client_prefers_mongo_uri(monkeypatch):
    class FakeClient:
        def __init__(self, uri, **_kwargs):
            self.uri = uri

    monkeypatch.setattr(database, "AsyncIOMotorClient", FakeClient)
    monkeypatch.setattr(database, "_client", None)
    monkeypatch.setenv("MONGO_URI", "mongodb+srv://atlas.example/rotta")
    monkeypatch.setenv("MONGO_URL", "mongodb://legacy")

    assert database.get_client().uri == "mongodb+srv://atlas.example/rotta"


def test_get_client_keeps_mongo_url_compatibility(monkeypatch):
    class FakeClient:
        def __init__(self, uri, **_kwargs):
            self.uri = uri

    monkeypatch.setattr(database, "AsyncIOMotorClient", FakeClient)
    monkeypatch.setattr(database, "_client", None)
    monkeypatch.delenv("MONGO_URI", raising=False)
    monkeypatch.setenv("MONGO_URL", "mongodb://legacy")

    assert database.get_client().uri == "mongodb://legacy"
