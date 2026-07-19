import sys
import os
from typing import List, Dict, Any

# 1. Path Injection: Append Medical-Graph-RAG to sys.path
submodule_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../external/Medical-Graph-RAG"))
if submodule_path not in sys.path:
    sys.path.append(submodule_path)

# 2. Lazy imports of submodule libraries after path injection
from camel.storages import Neo4jGraph
from summerize import process_chunks
from retrieve import seq_ret
from utils import get_response, ret_context, link_context

from src.config import settings

class URetrievalEngine:
    """
    Submodule-reusing U-Retrieval Engine.
    Leverages seq_ret (U-Retrieval summary rating) and get_response (multi-step reference resolver)
    natively from the paper's original codebase to deliver clinical-grade citations.
    """
    
    def __init__(self):
        # We reuse the connection parameters from global config
        self.uri = settings.NEO4J_URI
        self.user = settings.NEO4J_USER
        self.password = settings.NEO4J_PASSWORD

    def _get_n4j_connection(self) -> Neo4jGraph:
        """Instantiates the CAMEL Neo4jGraph wrapper."""
        return Neo4jGraph(
            url=self.uri,
            username=self.user,
            password=self.password
        )

    def answer_query(self, query: str) -> Dict[str, Any]:
        """
        Executes the dual-stage U-Retrieval pipeline to identify the best document context
        and compile an authentic, grounded medical response with correct references.
        """
        print(f"[*] Initiating U-Retrieval RAG pipeline for query: '{query}'")
        n4j = self._get_n4j_connection()
        
        # 1. Check if the Neo4j database is empty
        count_query = "MATCH (s:Summary) RETURN count(s) as count"
        try:
            count_res = n4j.query(count_query)
            summary_count = count_res[0]['count'] if count_res else 0
        except Exception as e:
            print(f"[!] Database connection failed: {e}")
            return {
                "query": query,
                "answer": f"Database connection error: {e}. Please ensure Neo4j and APOC/GDS are fully running.",
                "matched_document": "N/A",
                "retrieved_local_context": [],
                "retrieved_link_context": []
            }

        if summary_count == 0:
            print("[!] Medical knowledge graph is currently empty.")
            return {
                "query": query,
                "answer": "The medical knowledge graph is currently empty. Please ingest some textbooks, guidelines, or patient reports in the Ingestion Center first!",
                "matched_document": "N/A",
                "retrieved_local_context": [],
                "retrieved_link_context": []
            }
            
        try:
            # 2. Segment & Summarize the query text using submodule's process_chunks
            print("[*] Step 1: Processing query into categorized summary representation...")
            sumq = process_chunks(query)
            
            if not sumq:
                sumq = [query] # Fallback to raw query if empty
                
            # 3. Use submodule's seq_ret to score the summaries and select the best GID
            print("[*] Step 2: Scoring document summaries against the query via seq_ret...")
            gid = seq_ret(n4j, sumq)
            print(f"[+] Matched closest document GID: {gid}")
            
            # Fetch matched document name from Summary metadata
            doc_query = "MATCH (s:Summary {gid: $gid}) RETURN s.document_name as doc_name, s.layer as layer"
            doc_res = n4j.query(doc_query, {'gid': gid})
            doc_name = doc_res[0]['doc_name'] if doc_res and doc_res[0].get('doc_name') else f"Document ({gid[:8]})"
            layer_name = doc_res[0]['layer'] if doc_res and doc_res[0].get('layer') else "N/A"
            
            # 4. Generate response using submodule's get_response
            print("[*] Step 3: Compiling citation-grounded response via get_response...")
            grounded_answer = get_response(n4j, gid, query)
            
            # 5. Fetch structural contexts to present evidence transparently in UI
            local_context = ret_context(n4j, gid)
            linked_context = link_context(n4j, gid)
            
            return {
                "query": query,
                "answer": grounded_answer,
                "matched_document": f"{doc_name} [{layer_name.upper()} Layer]",
                "retrieved_local_context": local_context,
                "retrieved_link_context": linked_context
            }
            
        except Exception as e:
            print(f"[!] U-Retrieval execution failed: {e}")
            import traceback
            traceback.print_exc()
            return {
                "query": query,
                "answer": f"An error occurred during retrieval: {str(e)}. Please check active LLM settings and database status.",
                "matched_document": "N/A",
                "retrieved_local_context": [],
                "retrieved_link_context": []
            }

# Singleton search engine
u_retrieval_engine = URetrievalEngine()
