import os
import logging
import contextvars
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

logger = logging.getLogger(__name__)

current_user_id_var = contextvars.ContextVar("current_user_id_var", default=None)


# Mock database client for fallback if MongoDB is not running locally
class MockCollection:
    def __init__(self):
        self._data = {}

    def find_one(self, query, projection=None):
        for doc in self._data.values():
            if self._match(doc, query):
                return doc.copy()
        return None

    def find(self, query=None, projection=None):
        query = query or {}
        results = []
        for doc in self._data.values():
            if self._match(doc, query):
                results.append(doc.copy())
        return results

    def insert_one(self, document):
        doc = document.copy()
        if "_id" not in doc:
            import uuid
            doc["_id"] = str(uuid.uuid4())
        self._data[doc["_id"]] = doc
        class Result:
            inserted_id = doc["_id"]
        return Result()

    def update_one(self, query, update, upsert=False):
        set_fields = update.get("$set", {})
        matched_doc = None
        for doc in self._data.values():
            if self._match(doc, query):
                matched_doc = doc
                break
        
        if matched_doc:
            matched_doc.update(set_fields)
            class Result:
                matched_count = 1
                modified_count = 1
            return Result()
        elif upsert:
            new_doc = query.copy()
            new_doc.update(set_fields)
            self.insert_one(new_doc)
            class Result:
                matched_count = 0
                modified_count = 1
            return Result()
            
        class Result:
            matched_count = 0
            modified_count = 0
        return Result()

    def delete_one(self, query):
        to_delete = None
        for k, doc in self._data.items():
            if self._match(doc, query):
                to_delete = k
                break
        if to_delete:
            del self._data[to_delete]
            class Result:
                deleted_count = 1
            return Result()
        class Result:
            deleted_count = 0
        return Result()

    def _match(self, doc, query):
        for k, v in query.items():
            if k == "$or":
                if not any(self._match(doc, sub) for sub in v):
                    return False
            elif doc.get(k) != v:
                return False
        return True

class MockDatabase:
    def __init__(self):
        self._collections = {}

    def __getitem__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection()
        return self._collections[name]

class MockClient:
    def __init__(self):
        self._db = MockDatabase()

    def __getitem__(self, name):
        return self._db


# Real / Mock Client selector
_client = None

def get_db():
    global _client
    if _client is not None:
        return _client["aegis_flow"]

    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/aegis_flow")
    try:
        # Attempt to connect to real MongoDB
        # set connection timeout to 3 seconds for quick fallback
        client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=3000)
        # Ping the server to verify connection is alive
        client.admin.command('ping')
        _client = client
        logger.info(f"Connected to MongoDB successfully at {mongodb_uri.split('@')[-1] if '@' in mongodb_uri else mongodb_uri}")
    except (ConnectionFailure, Exception) as e:
        if os.getenv("RENDER") == "true" or os.getenv("MONGODB_URI"):
            logger.error(f"CRITICAL: Failed to connect to MongoDB in production environment ({e}). Exiting.")
            raise e
        logger.warning(f"Failed to connect to MongoDB ({e}). Falling back to memory mock database.")
        _client = MockClient()
        
    return _client["aegis_flow"]
