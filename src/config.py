import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    ENV: str = "dev"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Neo4j Graph Database
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "medragpassword123"
    
    # Qdrant Vector Database
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "medical_chunks"
    
    # LLM Configuration
    # Provider options: "ollama", "vllm", "gemini", "openai"
    LLM_PROVIDER: str = "ollama"
    
    # Provider-specific settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3:latest" # Default Ollama model
    
    VLLM_BASE_URL: str = "http://localhost:8000/v1"
    VLLM_MODEL: str = "Qwen/Qwen2.5-7B-Instruct"
    
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4-turbo"
    
    # UMLS Clinical Dictionary API Key
    UMLS_API_KEY: str = ""
    
    # Data directory setup
    DATA_INPUT_DIR: str = "data/input"
    DATA_PROCESSED_DIR: str = "data/processed"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# ----------------------------------------------------
# Dynamic OpenAI Environment Overrides (Submodule Intercept)
# ----------------------------------------------------
def apply_submodule_env_overrides():
    provider = settings.LLM_PROVIDER.lower()
    
    if provider == "ollama":
        # Ensure "/v1" suffix for Ollama
        base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        if not base_url.endswith("/v1"):
            base_url += "/v1"
        os.environ["OPENAI_API_BASE_URL"] = base_url
        os.environ["OPENAI_API_KEY"] = "ollama"
        # Also map standard OPENAI_API_BASE for other client frameworks
        os.environ["OPENAI_API_BASE"] = base_url
        
    elif provider == "vllm":
        os.environ["OPENAI_API_BASE_URL"] = settings.VLLM_BASE_URL
        os.environ["OPENAI_API_KEY"] = "vllm"
        os.environ["OPENAI_API_BASE"] = settings.VLLM_BASE_URL
        
    elif provider == "gemini":
        # Google official OpenAI compatible endpoint
        os.environ["OPENAI_API_BASE_URL"] = "https://generativelanguage.googleapis.com/v1beta/openai/"
        os.environ["OPENAI_API_KEY"] = settings.GEMINI_API_KEY
        os.environ["OPENAI_API_BASE"] = "https://generativelanguage.googleapis.com/v1beta/openai/"
        
    elif provider == "openai":
        os.environ["OPENAI_API_BASE_URL"] = "https://api.openai.com/v1"
        os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
        os.environ["OPENAI_API_BASE"] = "https://api.openai.com/v1"

apply_submodule_env_overrides()

# Ensure directories exist
os.makedirs(settings.DATA_INPUT_DIR, exist_ok=True)
os.makedirs(settings.DATA_PROCESSED_DIR, exist_ok=True)
