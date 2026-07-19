from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from typing import List, Dict, Any, Optional
from src.config import settings

class QdrantDbClient:
    """
    On-premises Qdrant client for handling high-performance vector search over medical chunk embeddings.
    """
    def __init__(self):
        self.host = settings.QDRANT_HOST
        self.port = settings.QDRANT_PORT
        self.collection_name = settings.QDRANT_COLLECTION
        self.client = None

    def connect(self):
        if self.client is None:
            print(f"[*] Connecting to Qdrant at {self.host}:{self.port}...")
            self.client = QdrantClient(host=self.host, port=self.port)

    def verify_connectivity(self) -> bool:
        try:
            self.connect()
            # Try to fetch collections to verify active socket
            self.client.get_collections()
            return True
        except Exception as e:
            print(f"[!] Qdrant connectivity error: {e}")
            return False

    def init_collection(self, vector_size: int = 1536):
        """
        Creates the target collection in Qdrant if it does not already exist.
        Default vector size is 1536 (OpenAI / nomic-embed-text standard).
        """
        self.connect()
        try:
            # Check if collection exists
            exists = self.client.collection_exists(self.collection_name)
            if not exists:
                print(f"[*] Creating Qdrant collection '{self.collection_name}' with size {vector_size}...")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
                )
            else:
                print(f"[*] Qdrant collection '{self.collection_name}' already exists.")
        except Exception as e:
            print(f"[!] Error initializing collection: {e}")

    def upsert_chunks(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
        """
        Inserts or updates vector points containing page-chunks and metadata payloads.
        """
        self.connect()
        # Initialize collection if not exists, based on first embedding size
        if embeddings:
            self.init_collection(vector_size=len(embeddings[0]))
            
        points = []
        for idx, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            points.append(PointStruct(
                id=hash(chunk["chunk_id"]) % (10**12), # Keep standard unsigned integer keys
                vector=vector,
                payload={
                    "chunk_id": chunk["chunk_id"],
                    "document_name": chunk["document_name"],
                    "pages": chunk["pages"],
                    "content": chunk["content"]
                }
            ))
            
        try:
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            print(f"[*] Successfully uploaded {len(points)} chunks to Qdrant.")
        except Exception as e:
            print(f"[!] Failed uploading to Qdrant: {e}")

    def search_similar_chunks(self, query_vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
        """
        Returns similar vector chunks matching query vector, sorted by score.
        """
        self.connect()
        if not self.client.collection_exists(self.collection_name):
            return []
            
        try:
            hits = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=limit
            )
            
            results = []
            for hit in hits:
                payload = hit.payload or {}
                results.append({
                    "chunk_id": payload.get("chunk_id", ""),
                    "document_name": payload.get("document_name", ""),
                    "pages": payload.get("pages", []),
                    "content": payload.get("content", ""),
                    "score": hit.score
                })
            return results
        except Exception as e:
            print(f"[!] Failed searching Qdrant vector store: {e}")
            return []

# Singleton instance
qdrant_client = QdrantDbClient()
