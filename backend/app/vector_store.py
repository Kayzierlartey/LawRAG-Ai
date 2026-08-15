import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


class VectorStore:
    def __init__(self):
        print("Loading embedding model...")

        self.model = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

        self.documents = {}

        print("Embedding model ready.")

    def add_document(self, document_id, chunks):
        if not chunks:
            return

        texts = [
            chunk["text"]
            for chunk in chunks
        ]

        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        embeddings = np.asarray(
            embeddings,
            dtype="float32",
        )

        dimension = embeddings.shape[1]

        index = faiss.IndexFlatIP(dimension)

        index.add(embeddings)

        self.documents[document_id] = {
            "index": index,
            "chunks": chunks,
        }

        print(
            f"Indexed {len(chunks)} chunks "
            f"for document {document_id}"
        )

    def search(
        self,
        document_id,
        query,
        top_k=5,
    ):
        if document_id not in self.documents:
            return []

        data = self.documents[document_id]

        if not data["chunks"]:
            return []

        query_embedding = self.model.encode(
            [query],
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        query_embedding = np.asarray(
            query_embedding,
            dtype="float32",
        )

        actual_k = min(
            top_k,
            len(data["chunks"]),
        )

        scores, indexes = data["index"].search(
            query_embedding,
            actual_k,
        )

        results = []

        for score, index in zip(
            scores[0],
            indexes[0],
        ):
            if index < 0:
                continue

            chunk = data["chunks"][index]

            results.append(
                {
                    "page": chunk["page"],
                    "text": chunk["text"],
                    "score": float(score),
                }
            )

        return results

    def delete_document(self, document_id):
        if document_id in self.documents:
            del self.documents[document_id]


vector_store = VectorStore()