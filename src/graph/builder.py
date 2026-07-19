import sys
import os
import argparse
from typing import List, Dict, Any

# 1. Path Injection: Append Medical-Graph-RAG to sys.path
submodule_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../external/Medical-Graph-RAG"))
if submodule_path not in sys.path:
    sys.path.append(submodule_path)

# 2. Lazy imports of submodule libraries after path injection
from camel.storages import Neo4jGraph
from creat_graph_with_description import creat_metagraph_with_description
from utils import str_uuid, ref_link

from src.config import settings

class MedicalGraphBuilder:
    """
    Submodule-reusing Graph Builder.
    Integrates CAMEL agents & nano_graphrag extraction to construct 
    authentic 3-layer medical knowledge graphs with descriptive properties.
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

    def ingest_document_to_layer(self, layer_name: str, content: str, doc_name: str) -> str:
        """
        Parses text, constructs nodes/relationships with nano_graphrag prompts,
        and dynamically creates Trinity cross-layer connections.
        
        Args:
            layer_name: The targeted layer ('bottom', 'middle', 'top')
            content: Raw extracted text of the document
            doc_name: Original file name or identifier
            
        Returns:
            gid: The unique ID generated for this document's subgraph
        """
        print(f"[*] Starting ingestion for document '{doc_name}' into {layer_name.upper()} layer...")
        
        # Instantiate Neo4j connection
        n4j = self._get_n4j_connection()
        
        # Generate new GID for this document
        gid = str_uuid()
        
        # Build argparse simulation for submodule properties
        args = argparse.Namespace(grained_chunk=True, ingraphmerge=True)
        
        # Invoke submodule metagraph constructor
        # This automatically splits text into chunks, runs CAMEL entity extraction,
        # computes embeddings, writes nodes/relations and builds the Summary node.
        creat_metagraph_with_description(args, content, gid, n4j)
        
        # Tag Summary node with Layer information and Document name for persistence
        tag_query = """
        MATCH (s:Summary {gid: $gid})
        SET s.layer = $layer, s.document_name = $doc_name
        RETURN s
        """
        n4j.query(tag_query, {'gid': gid, 'layer': layer_name.lower(), 'doc_name': doc_name})
        
        # Trigger Trinity Reference linking across layers dynamically!
        self.link_trinity_relations(n4j, gid, layer_name.lower())
        
        print(f"[+] Ingestion completed successfully. Registered GID: {gid}")
        return gid

    def link_trinity_relations(self, n4j: Neo4jGraph, gid: str, layer_name: str):
        """
        Calculates cosine similarity and builds :REFERENCE relations across layers
        based on the newly inserted document GID.
        """
        print(f"[*] Triggering cross-layer Trinity Reference Linker for {gid[:8]}...")
        total_links = 0
        
        if layer_name == "top":
            # Link all Middle layer documents pointing to this new Top layer document
            middle_gids = self._get_gids_for_layer(n4j, "middle")
            for m_gid in middle_gids:
                try:
                    res = ref_link(n4j, m_gid, gid)
                    if res:
                        total_links += len(res)
                except Exception as e:
                    print(f"  [!] Trinity error linking middle {m_gid[:8]} -> top {gid[:8]}: {e}")
                    
        elif layer_name == "middle":
            # Link Bottom -> new Middle
            bottom_gids = self._get_gids_for_layer(n4j, "bottom")
            for b_gid in bottom_gids:
                try:
                    res = ref_link(n4j, b_gid, gid)
                    if res:
                        total_links += len(res)
                except Exception as e:
                    print(f"  [!] Trinity error linking bottom {b_gid[:8]} -> middle {gid[:8]}: {e}")
            
            # Link new Middle -> Top
            top_gids = self._get_gids_for_layer(n4j, "top")
            for t_gid in top_gids:
                try:
                    res = ref_link(n4j, gid, t_gid)
                    if res:
                        total_links += len(res)
                except Exception as e:
                    print(f"  [!] Trinity error linking middle {gid[:8]} -> top {t_gid[:8]}: {e}")
                    
        elif layer_name == "bottom":
            # Link new Bottom -> Middle
            middle_gids = self._get_gids_for_layer(n4j, "middle")
            for m_gid in middle_gids:
                try:
                    res = ref_link(n4j, gid, m_gid)
                    if res:
                        total_links += len(res)
                except Exception as e:
                    print(f"  [!] Trinity error linking bottom {gid[:8]} -> middle {m_gid[:8]}: {e}")
                    
        print(f"[+] Trinity linker created {total_links} reference relations for GID {gid[:8]}.")

    def _get_gids_for_layer(self, n4j: Neo4jGraph, layer_name: str) -> List[str]:
        """Queries Neo4j for all stored GIDs belonging to a layer."""
        query = """
        MATCH (s:Summary {layer: $layer})
        RETURN s.gid as gid
        """
        results = n4j.query(query, {'layer': layer_name})
        return [r['gid'] for r in results if r.get('gid')]

# Singleton instance
graph_builder = MedicalGraphBuilder()
