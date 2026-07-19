import os
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from src.config import settings
from src.db.neo4j_client import neo4j_client
from src.db.qdrant_client import qdrant_client
from src.ingestion.parser import doc_parser
from src.graph.builder import graph_builder
from src.retrieval.search import u_retrieval_engine

app = FastAPI(
    title="General-MED-RAG API Engine",
    description="On-premises Medical Graph RAG server compatible with local LLMs and Neo4j.",
    version="1.0.0"
)

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow any origin.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request-Response Models
class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    query: str
    answer: str
    matched_document: str
    retrieved_local_context: List[str]
    retrieved_link_context: List[str]

class StatusResponse(BaseModel):
    status: str
    databases: Dict[str, str]
    system_config: Dict[str, Any]

@app.on_event("startup")
def startup_event():
    print("[*] Starting General-MED-RAG backend server...")
    # Pre-verify connectivity to services
    neo4j_ok = "Connected" if neo4j_client.verify_connectivity() else "Offline"
    qdrant_ok = "Connected" if qdrant_client.verify_connectivity() else "Offline"
    print(f"[*] Neo4j Status: {neo4j_ok} | Qdrant Status: {qdrant_ok}")

@app.on_event("shutdown")
def shutdown_event():
    print("[*] Stopping General-MED-RAG services...")
    neo4j_client.close()

@app.get("/api/status", response_model=StatusResponse)
def get_status():
    """
    Checks on-premise infrastructure health and current configuration.
    """
    neo4j_ok = "Connected" if neo4j_client.verify_connectivity() else "Offline"
    qdrant_ok = "Connected" if qdrant_client.verify_connectivity() else "Offline"
    
    return {
        "status": "Healthy",
        "databases": {
            "neo4j": neo4j_ok,
            "qdrant": qdrant_ok
        },
        "system_config": {
            "llm_provider": settings.LLM_PROVIDER,
            "ollama_model": settings.OLLAMA_MODEL if settings.LLM_PROVIDER == "ollama" else None,
            "vllm_model": settings.VLLM_MODEL if settings.LLM_PROVIDER == "vllm" else None,
            "gemini_model": settings.GEMINI_MODEL if settings.LLM_PROVIDER == "gemini" else None,
            "uploader_input_dir": settings.DATA_INPUT_DIR
        }
    }

@app.post("/api/ingest")
def upload_and_ingest(
    file: UploadFile = File(...), 
    layer: str = Form("top") # Default to "top" (patient reports)
):
    """
    Ingests PDF/Ebook, parses contents, and constructs the Hierarchical Trinity Graph 
    directly within the chosen level in Neo4j using submodule pipeline.
    """
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    target_layer = layer.lower()
    if target_layer not in ["bottom", "middle", "top"]:
        raise HTTPException(status_code=400, detail="Layer must be 'bottom', 'middle', or 'top'")

    # Securely save uploaded file locally
    local_path = os.path.join(settings.DATA_INPUT_DIR, filename)
    try:
        with open(local_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write uploaded file to disk: {e}")
        
    print(f"[*] Saved uploaded file to: {local_path}. Target layer: {target_layer.upper()}")
    
    try:
        # Step 1: Parse Text (with EasyOCR fallback)
        pages_content = doc_parser.parse_document(local_path)
        
        if not pages_content:
            raise HTTPException(status_code=400, detail="No readable content found in uploaded document")
            
        # Join pages into single text content as expected by submodule importer
        full_content = "\n".join([p["content"] for p in pages_content])
        
        # Step 2: Build Hierarchical Trinity Graph in Neo4j using submodule graph builder
        gid = graph_builder.ingest_document_to_layer(
            layer_name=target_layer,
            content=full_content,
            doc_name=filename
        )
        
        return {
            "status": "Success",
            "filename": filename,
            "layer": target_layer,
            "gid": gid,
            "message": f"Document parsed and mapped in the {target_layer.upper()} Layer of the Trinity Graph."
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed during ingestion pipeline: {str(e)}")

@app.post("/api/query", response_model=QueryResponse)
def ask_question(request: QueryRequest):
    """
    Executes the U-Retrieval RAG algorithm using submodule's seq_ret and get_response modules.
    """
    try:
        res = u_retrieval_engine.answer_query(request.query)
        return {
            "query": res["query"],
            "answer": res["answer"],
            "matched_document": res["matched_document"],
            "retrieved_local_context": res["retrieved_local_context"],
            "retrieved_link_context": res["retrieved_link_context"]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error answering question: {str(e)}")

@app.get("/api/visualization")
def get_subgraph(limit: int = 150):
    """
    Returns the recent graph nodes and relationships in vis.js compatible format for React visualization.
    """
    try:
        subgraph = neo4j_client.fetch_visualization_subgraph(limit=limit)
        return subgraph
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching visualization graph: {str(e)}")
