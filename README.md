# General-MED-RAG: On-Premises Clinical AI Grounding Engine

General-MED-RAG is an enterprise-grade, privacy-secure, and offline-first Medical Graph RAG (Retrieval-Augmented Generation) system. It is designed based on the **Medical Graph RAG** paper ([arXiv:2408.04187](https://arxiv.org/abs/2408.04187)) and is built as an extensible wrapper around the [ImprintLab/Medical-Graph-RAG](https://github.com/ImprintLab/Medical-Graph-RAG) baseline.

The system is fully optimized for **on-premises deployment on Linux/WSL**, enabling safe medical query answering, easy data ingestion of medical textbooks (EPUB) and clinical reports (PDF), and live interactive visualization of hierarchical medical knowledge graphs.

---

## 🚀 Key Features

*   **U-Retrieval Algorithm**: Executes top-down semantic vector searches (in Qdrant) combined with bottom-up graph traversals (in Neo4j) to compile raw page context, identified clinical keywords, and medical dictionary definitions.
*   **Triple-Linked Trinity Graph**: Automatically structures ingested text into three separate hierarchical levels in Neo4j:
    1.  **Top Level (Chunks)**: Patient records and textbook passages.
    2.  **Medium Level (Entities)**: Identified clinical symptoms, diagnoses, and treatments.
    3.  **Bottom Level (Definitions)**: Verified dictionary explanations (MeSH/UMLS).
*   **Offline Ingestion & OCR Fallback**: Extracted text via PyMuPDF. If a scanned document or low-text image is uploaded, it automatically runs local OCR (EasyOCR) completely offline.
*   **LLM Router**: Seamlessly route queries to Frontier APIs (Gemini, OpenAI) or local LLM instances (Ollama, vLLM) via standard OpenAI-compatible endpoints.
*   **Premium React Web Interface**: Dark-themed, glassmorphic UI displaying real-time chat, upload queues, and custom SVG hierarchical graph diagrams.

---

## 📁 Repository Structure

```
General-MED-RAG/
├── .gitmodules                 # Submodule configuration
├── docker-compose.yml          # On-prem docker orchestration
├── requirements.txt            # Python dependencies
├── external/                   # Third-party submodules
│   └── Medical-Graph-RAG/      # Git submodule of original research repo
├── scripts/
│   └── check_spec.py           # On-prem environment and GPU spec validator
├── src/                        # FastAPI Backend Server code
│   ├── config.py               # Environments and configurations
│   ├── api/main.py             # FastAPI entrypoint and REST endpoints
│   ├── ingestion/parser.py     # Offline PDF parser + EasyOCR + Semantic Chunker
│   ├── db/                     # Database connectors (Neo4j, Qdrant)
│   ├── graph/builder.py        # Trinity Graph Constructor
│   └── llm/client.py           # Unified model router (Ollama / vLLM / Gemini)
└── frontend/                   # React + Vite Web UI
    ├── Dockerfile
    ├── index.html
    ├── src/App.jsx             # Main dashboard, tab layout, and SVG graph renderer
    └── src/index.css           # Premium clinical glassmorphism CSS theme
```

---

## 🛠️ Step-by-Step Installation & Deployment

Follow these instructions to deploy General-MED-RAG on-premises on your Linux machine:

### Step 1: Pre-requisite Spec Validation
Check if your hardware meets the minimum specs required to host database containers and local LLM servers:
```bash
python scripts/check_spec.py
```
*   **Minimum Specs**: 8 CPU Cores, 32GB RAM, 100GB SSD.
*   **Recommended (For Local LLM)**: 16 CPU Cores, 64GB RAM, Nvidia GPU with >= 12GB VRAM.

### Step 2: Install Local LLM (Ollama)
If running offline, download and install Ollama on your Linux host:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```
Start the Ollama service and download the recommended chat and embedding models:
```bash
# Pull chat model
ollama pull llama3:latest

# Pull embedding model
ollama pull nomic-embed-text
```

### Step 3: Launch Databases & App Containers
General-MED-RAG uses Docker-Compose to orchestrate services:
*   **Neo4j** (Graph Database): Stores the hierarchical medical entity-relation graph.
*   **Qdrant** (Vector Store): Stores page embeddings for high-speed top-down searches.
*   **FastAPI Backend**: Orchestrates parser, builders, routers, and search engine.
*   **React Frontend**: Serving the visual dashboard.

Run the launch command:
```bash
docker-compose up -d --build
```

### Step 4: Access the Dashboards
*   **Web Dashboard**: Open [http://localhost:3000](http://localhost:3000) in your web browser.
*   **Neo4j Web GUI**: Open [http://localhost:7474](http://localhost:7474) (Username: `neo4j`, Password: `medragpassword123`) to view and query raw graphs using Cypher.
*   **FastAPI API Docs**: Access Swagger API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 🧬 Configuration Management

To use external Frontier models (e.g. Gemini API, which is highly recommended for medical text reasoning) or change database ports, edit the environment variables in your `docker-compose.yml` or create a local `.env` file in the root directory:

```env
# Change LLM Provider
LLM_PROVIDER=gemini # Options: "ollama", "vllm", "gemini", "openai"

# API Keys
GEMINI_API_KEY=your_google_gemini_api_key_here
UMLS_API_KEY=your_umls_license_api_key_here
```

---

## ⚠️ Troubleshooting

1.  **Backend cannot reach Ollama**:
    Ensure Ollama is running on your host machine. On Linux, Docker containers access the host network via `http://host.docker.internal:11434`. This is pre-configured in `docker-compose.yml` under `extra_hosts`.
2.  **Neo4j out of memory**:
    If parsing extremely large medical textbook PDFs (>500 pages), increase container RAM limit or split documents into chapters before uploading.
