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

def apply_model_patches():
    provider = settings.LLM_PROVIDER.lower()
    
    # Define target models based on provider
    if provider == "gemini":
        chat_model = settings.GEMINI_MODEL # gemini-2.5-flash
        embed_model = "text-embedding-004"
    elif provider == "ollama":
        chat_model = settings.OLLAMA_MODEL # llama3:latest
        embed_model = "nomic-embed-text"
    elif provider == "vllm":
        chat_model = settings.VLLM_MODEL
        embed_model = "text-embedding-3-small" # fallback or user specific
    else:
        # For standard openai provider, keep original
        return

    # Patch OpenAI package (both Sync and Async clients)
    try:
        import openai
        
        # Patch chat completions create
        original_chat_create = openai.resources.chat.completions.Completions.create
        def patched_chat_create(self, *args, **kwargs):
            if "model" in kwargs:
                kwargs["model"] = chat_model
            return original_chat_create(self, *args, **kwargs)
        openai.resources.chat.completions.Completions.create = patched_chat_create

        original_async_chat_create = openai.resources.chat.completions.AsyncCompletions.create
        async def patched_async_chat_create(self, *args, **kwargs):
            if "model" in kwargs:
                kwargs["model"] = chat_model
            return await original_async_chat_create(self, *args, **kwargs)
        openai.resources.chat.completions.AsyncCompletions.create = patched_async_chat_create

        # Patch embeddings create
        original_embed_create = openai.resources.embeddings.Embeddings.create
        def patched_embed_create(self, *args, **kwargs):
            if "model" in kwargs:
                kwargs["model"] = embed_model
            return original_embed_create(self, *args, **kwargs)
        openai.resources.embeddings.Embeddings.create = patched_embed_create

        original_async_embed_create = openai.resources.embeddings.AsyncEmbeddings.create
        async def patched_async_embed_create(self, *args, **kwargs):
            if "model" in kwargs:
                kwargs["model"] = embed_model
            return await original_async_embed_create(self, *args, **kwargs)
        openai.resources.embeddings.AsyncEmbeddings.create = patched_async_embed_create
        
        print(f"[*] Patched OpenAI client model routing to: chat={chat_model}, embed={embed_model}")
    except Exception as e:
        print(f"[!] Failed to patch openai package: {e}")

    # Patch LangChain's ChatOpenAI
    try:
        from langchain_community.chat_models import ChatOpenAI
        original_lc_init = ChatOpenAI.__init__
        def patched_lc_init(self, *args, **kwargs):
            if "model" in kwargs:
                kwargs["model"] = chat_model
            elif "model_name" in kwargs:
                kwargs["model_name"] = chat_model
            else:
                kwargs["model"] = chat_model
            original_lc_init(self, *args, **kwargs)
        ChatOpenAI.__init__ = patched_lc_init
        print(f"[*] Patched LangChain ChatOpenAI constructor to default to: {chat_model}")
    except Exception as e:
        print(f"[!] Failed to patch langchain ChatOpenAI: {e}")

# Apply patches immediately
apply_model_patches()

def apply_submodule_patches():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_path = os.path.join(base_dir, "external", "Medical-Graph-RAG", "data_chunk.py")
    patch_path = os.path.join(base_dir, "src", "patches", "data_chunk.py")
    
    if os.path.exists(patch_path) and os.path.exists(os.path.dirname(target_path)):
        try:
            import shutil
            shutil.copy2(patch_path, target_path)
            print(f"[*] Successfully synchronized and applied local-LLM patch to submodule: {target_path}")
        except Exception as e:
            print(f"[!] Failed to apply data_chunk patch: {e}")

# Apply submodule patches
apply_submodule_patches()

# Ensure directories exist
os.makedirs(settings.DATA_INPUT_DIR, exist_ok=True)
os.makedirs(settings.DATA_PROCESSED_DIR, exist_ok=True)


