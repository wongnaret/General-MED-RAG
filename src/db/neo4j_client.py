from neo4j import GraphDatabase
from typing import List, Dict, Any, Tuple
from src.config import settings

class Neo4jClient:
    """
    On-premises Neo4j interface for managing Medical Knowledge Graphs.
    Supports Cypher transactions, node/edge insertion, and graph search.
    """
    def __init__(self):
        self.uri = settings.NEO4J_URI
        self.user = settings.NEO4J_USER
        self.password = settings.NEO4J_PASSWORD
        self.driver = None

    def connect(self):
        if self.driver is None:
            print(f"[*] Connecting to Neo4j database at {self.uri}...")
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))

    def close(self):
        if self.driver:
            self.driver.close()
            self.driver = None

    def verify_connectivity(self) -> bool:
        try:
            self.connect()
            self.driver.verify_connectivity()
            return True
        except Exception as e:
            print(f"[!] Neo4j connectivity error: {e}")
            return False

    def execute_query(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Executes a custom Cypher query and returns the list of result dictionaries.
        """
        self.connect()
        with self.driver.session() as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def create_medical_node(self, node_id: str, label: str, properties: Dict[str, Any]):
        """
        Creates a single node with specified properties. Labels must be capitalized (e.g. Entity, Article, Definition).
        """
        query = f"""
        MERGE (n:{label} {{id: $id}})
        SET n += $properties
        RETURN n
        """
        params = {
            "id": node_id,
            "properties": properties
        }
        self.execute_query(query, params)

    def create_medical_relationship(self, source_id: str, source_label: str, 
                                   target_id: str, target_label: str, 
                                   rel_type: str, properties: Dict[str, Any] = None):
        """
        Creates a directed relationship between two medical nodes.
        """
        # Ensure type safe query string formatting
        query = f"""
        MATCH (src:{source_label} {{id: $source_id}})
        MATCH (tgt:{target_label} {{id: $target_id}})
        MERGE (src)-[r:{rel_type}]->(tgt)
        SET r += $properties
        RETURN r
        """
        params = {
            "source_id": source_id,
            "target_id": target_id,
            "properties": properties or {}
        }
        self.execute_query(query, params)

    def get_graph_summary(self) -> Dict[str, Any]:
        """
        Returns a high-level summary count of nodes and relationships in the database.
        """
        if not self.verify_connectivity():
            return {"status": "Disconnected", "nodes": 0, "relationships": 0}
            
        nodes_query = "MATCH (n) RETURN labels(n) as labels, count(n) as count"
        rels_query = "MATCH ()-[r]->() RETURN type(r) as rel_type, count(r) as count"
        
        nodes_res = self.execute_query(nodes_query)
        rels_res = self.execute_query(rels_query)
        
        return {
            "status": "Connected",
            "nodes": {str(r["labels"]): r["count"] for r in nodes_res},
            "relationships": {r["rel_type"]: r["count"] for r in rels_res}
        }

    def fetch_visualization_subgraph(self, limit: int = 250) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetches up to LIMIT nodes and relations for interactive UI visualization.
        Extracts full node properties dictionary to feed the interactive side panel.
        """
        query = f"""
        MATCH (n)-[r]->(m)
        RETURN n as source, type(r) as type, m as target
        LIMIT {limit}
        """
        records = self.execute_query(query)
        
        nodes_dict = {}
        edges = []
        
        for record in records:
            src = record["source"]
            tgt = record["target"]
            edge_type = record["type"]
            
            # Format source node
            src_id = src.get("id", "unknown")
            if src_id not in nodes_dict:
                src_props = dict(src)
                src_name = src_props.get("name") or src_props.get("title") or src_props.get("description") or src_id
                nodes_dict[src_id] = {
                    "id": src_id,
                    "label": src_name,
                    "type": list(src.labels)[0] if hasattr(src, "labels") and src.labels else "Entity",
                    "properties": src_props
                }
                
            # Format target node
            tgt_id = tgt.get("id", "unknown")
            if tgt_id not in nodes_dict:
                tgt_props = dict(tgt)
                tgt_name = tgt_props.get("name") or tgt_props.get("title") or tgt_props.get("description") or tgt_id
                nodes_dict[tgt_id] = {
                    "id": tgt_id,
                    "label": tgt_name,
                    "type": list(tgt.labels)[0] if hasattr(tgt, "labels") and tgt.labels else "Entity",
                    "properties": tgt_props
                }
                
            # Edge
            edges.append({
                "source": src_id,
                "target": tgt_id,
                "type": edge_type
            })

        # Fetch orphan nodes if node limit permits
        if len(nodes_dict) < limit:
            orphan_query = f"""
            MATCH (n)
            RETURN n
            LIMIT {limit - len(nodes_dict)}
            """
            try:
                orphan_records = self.execute_query(orphan_query)
                for record in orphan_records:
                    node = record["n"]
                    node_id = node.get("id", "unknown")
                    if node_id not in nodes_dict:
                        props = dict(node)
                        name = props.get("name") or props.get("title") or props.get("description") or node_id
                        nodes_dict[node_id] = {
                            "id": node_id,
                            "label": name,
                            "type": list(node.labels)[0] if hasattr(node, "labels") and node.labels else "Entity",
                            "properties": props
                        }
            except Exception as e:
                print(f"[!] Error fetching orphan nodes: {e}")
            
        return {
            "nodes": list(nodes_dict.values()),
            "edges": edges
        }

# Singleton instance
neo4j_client = Neo4jClient()
