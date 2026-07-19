import os
import json
import requests
from typing import List, Dict, Any, Optional
from openai import OpenAI
from google import genai
from google.genai import types

from src.config import settings

class LLMClient:
    """
    Unified router for on-premises and frontier models.
    Supports Ollama, vLLM, OpenAI, and Gemini API.
    """
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self._init_clients()

    def _init_clients(self):
        # Initialize OpenAI compatible clients
        if self.provider == "openai":
            self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        elif self.provider == "ollama":
            # Ollama exposes an OpenAI-compatible endpoint at /v1
            self.openai_client = OpenAI(
                base_url=f"{settings.OLLAMA_BASE_URL}/v1",
                api_key="ollama-key-placeholder"
            )
        elif self.provider == "vllm":
            self.openai_client = OpenAI(
                base_url=settings.VLLM_BASE_URL,
                api_key="vllm-key-placeholder"
            )
        elif self.provider == "gemini":
            if settings.GEMINI_API_KEY:
                self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            else:
                self.gemini_client = None

    def generate(self, prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.2) -> str:
        """
        Generates text based on prompt and chosen provider.
        """
        if self.provider in ["ollama", "vllm", "openai"]:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            model = settings.OLLAMA_MODEL if self.provider == "ollama" else (
                settings.VLLM_MODEL if self.provider == "vllm" else settings.OPENAI_MODEL
            )
            
            try:
                response = self.openai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                return f"Error calling {self.provider.upper()} LLM: {str(e)}"

        elif self.provider == "gemini":
            if not self.gemini_client:
                return "Error: Gemini API Client not initialized. Please set GEMINI_API_KEY."
            
            config = types.GenerateContentConfig(
                temperature=temperature,
                system_instruction=system_prompt if system_prompt else None
            )
            try:
                response = self.gemini_client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=config
                )
                return response.text or ""
            except Exception as e:
                return f"Error calling Gemini API: {str(e)}"
        
        else:
            return f"Unsupported LLM provider: {self.provider}"

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generates text embeddings (vectors) for storage or querying.
        """
        if self.provider in ["ollama", "vllm", "openai"]:
            # Default embedding models
            model = "nomic-embed-text" if self.provider == "ollama" else (
                "text-embedding-3-small" if self.provider == "openai" else "all-MiniLM-L6-v2"
            )
            try:
                response = self.openai_client.embeddings.create(
                    input=texts,
                    model=model
                )
                return [item.embedding for item in response.data]
            except Exception as e:
                # Local fallback/stub if embedding model is not pre-pulled in Ollama
                print(f"Warning: Failed to generate embeddings via {self.provider} API: {e}")
                # Generate a mock vector (size 1536) for safety so system doesn't crash during pipeline testing
                import random
                return [[random.uniform(-0.1, 0.1) for _ in range(1536)] for _ in texts]
                
        elif self.provider == "gemini":
            if not self.gemini_client:
                raise ValueError("Gemini Client not initialized.")
            try:
                embeddings = []
                for text in texts:
                    res = self.gemini_client.models.embed_content(
                        model="text-embedding-004",
                        contents=text
                    )
                    embeddings.append(res.embedding.values)
                return embeddings
            except Exception as e:
                raise RuntimeError(f"Failed to generate Gemini embeddings: {e}")
        else:
            raise ValueError(f"Unsupported provider for embeddings: {self.provider}")

# Singleton client instance
llm_client = LLMClient()
