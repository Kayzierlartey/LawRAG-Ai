import os
import uuid

from dotenv import load_dotenv

load_dotenv()

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
)

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from .pdf_processor import (
    extract_pdf_pages,
    create_chunks,
)

from .vector_store import vector_store

from .rag import generate_answer


# ==========================================
# APP
# ==========================================

app = FastAPI(
    title="LawDoc AI API",
    description="RAG-powered legal document assistant",
    version="1.0.0",
)


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# DIRECTORIES
# ==========================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)


# ==========================================
# IN-MEMORY DOCUMENT REGISTRY
# ==========================================

documents = {}


# ==========================================
# REQUEST MODELS
# ==========================================

class ChatRequest(BaseModel):
    question: str
    document_id: str


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/")
def root():
    return {
        "message": "LawDoc AI API is running",
        "status": "online",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


# ==========================================
# GET DOCUMENTS
# ==========================================

@app.get("/api/documents")
def get_documents():
    return {
        "documents": list(
            documents.values()
        )
    }


# ==========================================
# UPLOAD DOCUMENT
# ==========================================

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    document_id = str(uuid.uuid4())

    filename = file.filename or "document.pdf"

    file_path = os.path.join(
        UPLOAD_DIR,
        f"{document_id}.pdf",
    )

    try:
        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded PDF is empty.",
            )

        with open(
            file_path,
            "wb",
        ) as output_file:
            output_file.write(contents)

        # Extract text
        pages = extract_pdf_pages(
            file_path
        )

        if not pages:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No readable text was found "
                    "in this PDF. Scanned PDFs may "
                    "require OCR."
                ),
            )

        # Create chunks
        chunks = create_chunks(
            pages
        )

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="Could not create document chunks.",
            )

        # Create embeddings + FAISS index
        vector_store.add_document(
            document_id,
            chunks,
        )

        document = {
            "id": document_id,
            "filename": filename,
            "pages": len(pages),
            "chunks": len(chunks),
        }

        documents[document_id] = document

        return {
            "message": (
                "Document uploaded and indexed successfully."
            ),
            "document": document,
        }

    except HTTPException:
        if os.path.exists(file_path):
            os.remove(file_path)

        raise

    except Exception as error:
        print(
            "Document processing error:",
            error,
        )

        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=(
                f"Document processing failed: {str(error)}"
            ),
        )


# ==========================================
# DELETE DOCUMENT
# ==========================================

@app.delete(
    "/api/documents/{document_id}"
)
def delete_document(
    document_id: str,
):
    if document_id not in documents:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    document_path = os.path.join(
        UPLOAD_DIR,
        f"{document_id}.pdf",
    )

    if os.path.exists(document_path):
        os.remove(document_path)

    del documents[document_id]

    vector_store.delete_document(
        document_id
    )

    return {
        "message": "Document deleted successfully."
    }


# ==========================================
# RAG CHAT
# ==========================================

@app.post("/api/chat")
def chat(request: ChatRequest):
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    if request.document_id not in documents:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    try:
        result = generate_answer(
            document_id=request.document_id,
            question=request.question,
        )

        return result

    except Exception as error:
        print(
            "Chat processing error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )