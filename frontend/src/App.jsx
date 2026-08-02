import React, { useState, useEffect, useRef } from 'react';
import { Network as VisNetwork } from 'vis-network';
import { DataSet } from 'vis-data';
import 'vis-network/styles/vis-network.css';

import { 
  Activity, 
  BookOpen, 
  Cpu, 
  Database, 
  FileText, 
  HelpCircle, 
  MessageSquare, 
  Network, 
  RefreshCw, 
  Settings, 
  UploadCloud,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  Search,
  Sliders,
  Filter,
  X,
  Sparkles,
  Eye,
  ArrowRight
} from 'lucide-react';

const API_BASE = '';

export default function App() {
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'ingest' | 'graph'
  const [status, setStatus] = useState({
    status: 'Loading',
    databases: { neo4j: 'Offline', qdrant: 'Offline' },
    system_config: { llm_provider: 'ollama' }
  });
  
  // Chat States
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      text: 'สวัสดีครับ ยินดีต้อนรับสู่ General-MED-RAG ผมเป็นผู้ช่วยแพทย์ปัญญาประดิษฐ์ (Clinical AI Assistant) คุณสามารถอัปโหลดเอกสารเข้าสู่ชั้นข้อมูล Trinity Layers (เช่น Dictionary, Guidelines, Patient Reports) และสืบค้นผ่านระบบ U-Retrieval RAG ที่สามารถเชื่อมโยงความรู้ข้ามเลเยอร์โดยอัตโนมัติครับ',
      matched_document: '',
      retrieved_local_context: [],
      retrieved_link_context: []
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Ingest States
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState('top'); // 'bottom' | 'middle' | 'top'
  const [ingestStatus, setIngestStatus] = useState(''); // 'idle' | 'uploading' | 'success' | 'error'
  const [ingestLog, setIngestLog] = useState('');
  const fileInputRef = useRef(null);
  
  // Graph visualization states
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [graphLoading, setGraphLoading] = useState(false);
  const [nodeLimit, setNodeLimit] = useState(100);
  const [layoutMode, setLayoutMode] = useState('hierarchical'); // 'hierarchical' | 'physics' | 'circular'
  const [searchQuery, setSearchQuery] = useState('');
  const [layerFilters, setLayerFilters] = useState({ top: true, middle: true, bottom: true });
  const [selectedNode, setSelectedNode] = useState(null);
  const visJsRef = useRef(null);
  const networkRef = useRef(null);
  
  // Fetch system status on mount
  useEffect(() => {
    fetchStatus();
    fetchGraphData(nodeLimit);
    
    // Poll status every 20s
    const interval = setInterval(fetchStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  // Re-fetch graph data when nodeLimit or activeTab changes
  useEffect(() => {
    if (activeTab === 'graph') {
      fetchGraphData(nodeLimit);
    }
  }, [nodeLimit, activeTab]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus(prev => ({ ...prev, status: 'Error Connecting to Backend' }));
      }
    } catch (e) {
      setStatus(prev => ({ ...prev, status: 'Backend Unreachable' }));
    }
  };

  const fetchGraphData = async (limit = nodeLimit) => {
    setGraphLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/visualization?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (e) {
      console.error("Failed to load graph nodes:", e);
    } finally {
      setGraphLoading(false);
    }
  };

  // Vis-Network Dynamic Renderer Effect
  useEffect(() => {
    if (activeTab !== 'graph' || !visJsRef.current || !graphData.nodes || graphData.nodes.length === 0) return;

    // Filter nodes based on layerFilters and searchQuery
    const filteredNodes = graphData.nodes.filter(node => {
      const isTop = node.type === 'Chunk' || node.type === 'Summary';
      const isMiddle = node.type === 'Entity';
      const isBottom = node.type === 'Definition';

      if (isTop && !layerFilters.top) return false;
      if (isMiddle && !layerFilters.middle) return false;
      if (isBottom && !layerFilters.bottom) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchLabel = node.label?.toLowerCase().includes(query);
        const matchType = node.type?.toLowerCase().includes(query);
        return matchLabel || matchType;
      }

      return true;
    });

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    const filteredEdges = graphData.edges?.filter(edge => 
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    ) || [];

    // Format Vis-Network nodes
    const visNodes = new DataSet(
      filteredNodes.map((node) => {
        const isSummary = node.type === 'Summary';
        const isChunk = node.type === 'Chunk';
        const isEntity = node.type === 'Entity';
        const isDefinition = node.type === 'Definition';

        let color = { background: '#1e293b', border: '#475569', highlight: { background: '#334155', border: '#38bdf8' } };
        let shape = 'dot';
        let size = 20;
        let level = 2;

        if (isSummary || isChunk) {
          level = 1;
          size = isSummary ? 26 : 22;
          shape = 'box';
          color = {
            background: isSummary ? '#3b1700' : '#1e1e24',
            border: isSummary ? '#e65c00' : '#8888a0',
            highlight: { background: '#4e1f00', border: '#ff8000' }
          };
        } else if (isEntity) {
          level = 2;
          size = 24;
          shape = 'dot';
          color = {
            background: '#042f2e',
            border: '#00f2fe',
            highlight: { background: '#085354', border: '#38bdf8' }
          };
        } else if (isDefinition) {
          level = 3;
          size = 20;
          shape = 'diamond';
          color = {
            background: '#2e1065',
            border: '#a18cd1',
            highlight: { background: '#4c1d95', border: '#c084fc' }
          };
        }

        return {
          id: node.id,
          label: node.label.length > 22 ? node.label.substring(0, 19) + '...' : node.label,
          title: `<b>${node.label}</b><br/>Type: ${node.type}<br/>ID: ${node.id}`,
          color: color,
          shape: shape,
          size: size,
          level: level,
          font: { color: '#f8fafc', face: 'Outfit, sans-serif', size: 12 },
          borderWidth: 2,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 8 }
        };
      })
    );

    // Format Vis-Network edges
    const visEdges = new DataSet(
      filteredEdges.map((edge, idx) => ({
        id: `e_${idx}`,
        from: edge.source,
        to: edge.target,
        label: edge.type,
        font: { color: '#94a3b8', size: 10, align: 'middle' },
        color: { color: 'rgba(255, 255, 255, 0.15)', highlight: '#00f2fe' },
        arrows: { to: { enabled: true, scaleFactor: 0.6 } },
        smooth: { type: 'curvedCW', roundness: 0.15 }
      }))
    );

    // Vis-Network Options
    const options = {
      autoResize: true,
      height: '100%',
      width: '100%',
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        navigationButtons: true
      },
      layout: {
        hierarchical: {
          enabled: layoutMode === 'hierarchical',
          direction: 'UD', // Up-Down (Top -> Middle -> Bottom)
          sortMethod: 'directed',
          nodeSpacing: 180,
          levelSeparation: 160
        }
      },
      physics: {
        enabled: layoutMode !== 'circular',
        solver: layoutMode === 'hierarchical' ? 'hierarchicalRepulsion' : 'barnesHut',
        barnesHut: {
          gravitationalConstant: -4000,
          centralGravity: 0.2,
          springLength: 100,
          springConstant: 0.04,
          damping: 0.09
        },
        hierarchicalRepulsion: {
          centralGravity: 0.0,
          springLength: 120,
          springConstant: 0.02,
          nodeDistance: 160,
          damping: 0.09
        }
      }
    };

    // Instantiate Vis.js Network
    const network = new VisNetwork(visJsRef.current, { nodes: visNodes, edges: visEdges }, options);
    networkRef.current = network;

    // Handle Node Selection (Click)
    network.on('selectNode', (params) => {
      const selectedId = params.nodes[0];
      const targetNode = graphData.nodes.find(n => n.id === selectedId);
      if (targetNode) {
        const connectedEdges = graphData.edges.filter(e => e.source === selectedId || e.target === selectedId);
        const neighborIds = new Set(connectedEdges.map(e => e.source === selectedId ? e.target : e.source));
        const neighbors = graphData.nodes.filter(n => neighborIds.has(n.id));

        setSelectedNode({
          ...targetNode,
          neighbors: neighbors,
          edges: connectedEdges
        });
      }
    });

    // Handle Deselect (Click Canvas)
    network.on('deselectNode', () => {
      setSelectedNode(null);
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData, layoutMode, layerFilters, searchQuery, activeTab]);

  // Handle Query Submission
  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    
    const userQuery = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userQuery }]);
    setChatLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery })
      });
      
      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          text: data.answer,
          matched_document: data.matched_document || 'N/A',
          retrieved_local_context: data.retrieved_local_context || [],
          retrieved_link_context: data.retrieved_link_context || []
        }]);
        fetchGraphData(nodeLimit);
      } else {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          text: 'ขออภัยด้วยครับ เกิดข้อผิดพลาดในการประมวลผลคำค้นหาระหว่าง RAG pipeline.'
        }]);
      }
    } catch (e) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        text: 'ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านได้ กรุณาตรวจสอบว่าระบบเบื้องหลังทั้งหมดเปิดทำงานอยู่'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Handle File Upload/Ingestion
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIngestStatus('uploading');
    setIngestLog(`กำลังส่งไฟล์ ${selectedFile.name} เข้าสู่เซิร์ฟเวอร์เพื่อประมวลผลระดับ ${selectedLayer.toUpperCase()} Layer...`);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('layer', selectedLayer);

    try {
      const res = await fetch(`${API_BASE}/api/ingest`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setIngestStatus('success');
        setIngestLog(`ประมวลผลนำเข้าไฟล์สำเร็จ! สร้างกราฟความรู้รหัส GID: ${data.gid}`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchGraphData(nodeLimit);
      } else {
        const errData = await res.json();
        setIngestStatus('error');
        setIngestLog(`เกิดข้อผิดพลาดระหว่าง Ingestion Pipeline: ${errData.detail || 'Unknown Error'}`);
      }
    } catch (e) {
      setIngestStatus('error');
      setIngestLog(`ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลังบ้านเพื่ออัปโหลดไฟล์ได้ (${e.message})`);
    }
  };

  // Handle Shortcut Query for Node Side Panel
  const handleQueryNodeRAG = (node) => {
    const nodeName = node.label || node.properties?.name || node.id;
    setChatInput(`อธิบายรายละเอียดและความสัมพันธ์ทางการแพทย์ของ ${nodeName} จากคลังข้อมูล Trinity Graph`);
    setActiveTab('chat');
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar glass-panel">
        <div className="brand">
          <Activity className="brand-icon" size={28} />
          <div className="brand-text">
            <h2>General-MED</h2>
            <span className="badge">RAG Trinity</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} />
            <span>Clinical Chat RAG</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'ingest' ? 'active' : ''}`}
            onClick={() => setActiveTab('ingest')}
          >
            <UploadCloud size={18} />
            <span>Ingest Document</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            <Network size={18} />
            <span>Knowledge Graph</span>
          </button>
        </nav>

        {/* Status Widget */}
        <div className="system-status-card glass-panel">
          <div className="status-header">
            <Cpu size={16} />
            <span>On-Premise Engine</span>
          </div>
          <div className="status-indicator">
            <span className={`status-dot ${status.status === 'Healthy' ? 'online' : 'offline'}`}></span>
            <span className="status-text">{status.status}</span>
          </div>
          <div className="model-info">
            <span>Provider: <strong>{status.system_config?.llm_provider || 'Ollama'}</strong></span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header */}
        <header className="top-header">
          <div>
            <h1 className="page-title">
              {activeTab === 'chat' && 'Clinical Assistant & Medical Grounding'}
              {activeTab === 'ingest' && 'Trinity Document Ingestion Pipeline'}
              {activeTab === 'graph' && 'Hierarchical Knowledge Graph'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'chat' && ' ground answers with verified clinical textbooks and patient graphs'}
              {activeTab === 'ingest' && ' offline parser using local EasyOCR for secure, air-gapped data uploads'}
              {activeTab === 'graph' && ' live structural visualization of Triple-Linked Medical Nodes'}
            </p>
          </div>
        </header>

        {/* ==================== TAB 1: CLINICAL CHAT RAG ==================== */}
        {activeTab === 'chat' && (
          <div className="dashboard-grid animate-slideup">
            
            {/* LEFT PANE: Chat box */}
            <div className="glass-panel chat-section">
              <div className="chat-messages">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`message-bubble ${msg.role}`}>
                    <div className="message-content">
                      <p>{msg.text}</p>
                      
                      {/* Context Metadata Cards */}
                      {msg.role === 'assistant' && msg.retrieved_local_context && msg.retrieved_local_context.length > 0 && (
                        <div className="retrieved-context-box">
                          <div className="context-header">
                            <BookOpen size={14} />
                            <span>Retrieved Local Context (Page Chunks):</span>
                          </div>
                          <ul>
                            {msg.retrieved_local_context.map((ctx, i) => (
                              <li key={i}>{ctx}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.retrieved_link_context && msg.retrieved_link_context.length > 0 && (
                        <div className="retrieved-context-box link-context">
                          <div className="context-header">
                            <Layers size={14} />
                            <span>Trinity Cross-Layer References:</span>
                          </div>
                          <ul>
                            {msg.retrieved_link_context.map((link, i) => (
                              <li key={i}>{link}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="message-bubble assistant loading">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      กำลังเรียกใช้ U-Retrieval Algorithm สืบค้นกราฟ Neo4j และ Qdrant...
                    </span>
                  </div>
                )}
              </div>

              <form onSubmit={handleQuerySubmit} className="chat-input-area">
                <input 
                  type="text" 
                  placeholder="พิมพ์คำถามทางการแพทย์ (เช่น อาการ โรค หรือแนวทางการรักษาของคนไข้)..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" className="primary-btn" disabled={chatLoading || !chatInput.trim()}>
                  <ChevronRight size={18} />
                </button>
              </form>
            </div>

            {/* RIGHT PANE: Quick Info */}
            <div className="side-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-panel info-card">
                <h3>U-Retrieval Architecture</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  ระบบผสมผสานการค้นหา Top-Down Vector Search ร่วมกับ Bottom-Up Graph Traversal เพื่อยืนยันคำตอบทางการแพทย์ที่แม่นยำ ปราศจากการมโนข้อมูล (Hallucination)
                </p>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="layer-tag top">
                    <span>Top Layer: Patient Reports & Textbooks</span>
                  </div>
                  <div className="layer-tag middle">
                    <span>Middle Layer: Clinical Symptoms & Drugs</span>
                  </div>
                  <div className="layer-tag bottom">
                    <span>Bottom Layer: Dictionary Definitions (UMLS)</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB 2: DOCUMENT INGESTION ==================== */}
        {activeTab === 'ingest' && (
          <div className="glass-panel animate-slideup" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>นำเข้าเอกสารการแพทย์สู่ระบบ Trinity Layers</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                อัปโหลดไฟล์ข้อความสกัดความรู้ (.txt, .pdf) เพื่อให้ระบบทำการแยกแอนทิตีทางการแพทย์และเชื่อมโยงเส้นความสัมพันธ์ลง Neo4j
              </p>
            </div>

            <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Layer Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 500 }}>
                  เลือกระดับชั้นความรู้ (Target Trinity Layer):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div 
                    className={`layer-select-card ${selectedLayer === 'top' ? 'selected' : ''}`}
                    onClick={() => setSelectedLayer('top')}
                  >
                    <FileText size={20} />
                    <div>
                      <strong>Top Layer</strong>
                      <span>Patient Cases & Medical Reports</span>
                    </div>
                  </div>

                  <div 
                    className={`layer-select-card ${selectedLayer === 'middle' ? 'selected' : ''}`}
                    onClick={() => setSelectedLayer('middle')}
                  >
                    <BookOpen size={20} />
                    <div>
                      <strong>Middle Layer</strong>
                      <span>Clinical Practice Guidelines</span>
                    </div>
                  </div>

                  <div 
                    className={`layer-select-card ${selectedLayer === 'bottom' ? 'selected' : ''}`}
                    onClick={() => setSelectedLayer('bottom')}
                  >
                    <Database size={20} />
                    <div>
                      <strong>Bottom Layer</strong>
                      <span>Medical Dictionary & Definitions</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                className="drop-zone glass-panel"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={40} style={{ color: 'var(--primary)' }} />
                <div>
                  <p style={{ fontWeight: 500 }}>คลิกเพื่อเลือกไฟล์เอกสาร หรือลากไฟล์มาวางที่นี่</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {selectedFile ? `ไฟล์ที่เลือก: ${selectedFile.name}` : 'รองรับไฟล์ข้อความทางการแพทย์ (.txt, .pdf, .epub)'}
                  </p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  style={{ display: 'none' }}
                  accept=".txt,.pdf,.epub"
                />
              </div>

              <button 
                type="submit" 
                className="primary-btn"
                style={{ padding: '12px 24px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
                disabled={!selectedFile || ingestStatus === 'uploading'}
              >
                <UploadCloud size={18} />
                <span>เริ่มกระบวนการ Ingest เข้าสู่ Neo4j & Qdrant</span>
              </button>
            </form>

            {/* Logs Area */}
            {ingestLog && (
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', fontSize: '0.85rem' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: ingestStatus === 'error' ? 'var(--danger)' : 'var(--primary)' }}>
                  สถานะการทำงาน: {ingestStatus.toUpperCase()}
                </strong>
                <p style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{ingestLog}</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: KNOWLEDGE GRAPH VISUALIZER ==================== */}
        {activeTab === 'graph' && (
          <div className="glass-panel animate-slideup" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header & Main Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Network size={20} style={{ color: 'var(--primary)' }} />
                  <span>ความสัมพันธ์ขององค์ประกอบแพทย์ใน Neo4j (Triple-Graph Structure)</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  แสดงความสัมพันธ์ระหว่าง 3 ชั้นข้อมูล: Chunks เอกสารสีขาว (Top) ➜ คีย์เวิร์ดอาการและพยาธิสภาพสีฟ้า (Medium) ➜ คำนิยามคลังคำศัพท์ UMLS สีม่วง (Bottom)
                </p>
              </div>
              <button 
                onClick={() => fetchGraphData(nodeLimit)} 
                className="glass-panel" 
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '8px' }}
                disabled={graphLoading}
              >
                <RefreshCw size={14} style={{ animation: graphLoading ? 'spin 2s linear infinite' : 'none' }} />
                <span>รีเฟรชข้อมูลกราฟ</span>
              </button>
            </div>

            {/* Interactive Control Bar */}
            <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
              
              {/* Layout Mode Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Layout Mode:</span>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '3px' }}>
                  <button 
                    onClick={() => setLayoutMode('hierarchical')}
                    style={{ 
                      padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: layoutMode === 'hierarchical' ? 'var(--primary)' : 'transparent',
                      color: layoutMode === 'hierarchical' ? '#000' : 'var(--text-secondary)',
                      fontWeight: layoutMode === 'hierarchical' ? 600 : 400
                    }}
                  >
                    3-Layer Hierarchy
                  </button>
                  <button 
                    onClick={() => setLayoutMode('physics')}
                    style={{ 
                      padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: layoutMode === 'physics' ? 'var(--primary)' : 'transparent',
                      color: layoutMode === 'physics' ? '#000' : 'var(--text-secondary)',
                      fontWeight: layoutMode === 'physics' ? 600 : 400
                    }}
                  >
                    Force Physics
                  </button>
                  <button 
                    onClick={() => setLayoutMode('circular')}
                    style={{ 
                      padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: layoutMode === 'circular' ? 'var(--primary)' : 'transparent',
                      color: layoutMode === 'circular' ? '#000' : 'var(--text-secondary)',
                      fontWeight: layoutMode === 'circular' ? 600 : 400
                    }}
                  >
                    Circular
                  </button>
                </div>
              </div>

              {/* Layer Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Filter Layers:</span>
                <button 
                  onClick={() => setLayerFilters(prev => ({ ...prev, top: !prev.top }))}
                  style={{
                    padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px', cursor: 'pointer',
                    background: layerFilters.top ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: layerFilters.top ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                    color: layerFilters.top ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  Top (Chunks)
                </button>
                <button 
                  onClick={() => setLayerFilters(prev => ({ ...prev, middle: !prev.middle }))}
                  style={{
                    padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px', cursor: 'pointer',
                    background: layerFilters.middle ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: layerFilters.middle ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    color: layerFilters.middle ? 'var(--primary)' : 'var(--text-muted)'
                  }}
                >
                  Middle (Entities)
                </button>
                <button 
                  onClick={() => setLayerFilters(prev => ({ ...prev, bottom: !prev.bottom }))}
                  style={{
                    padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px', cursor: 'pointer',
                    background: layerFilters.bottom ? 'rgba(161, 140, 209, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: layerFilters.bottom ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                    color: layerFilters.bottom ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  Bottom (UMLS)
                </button>
              </div>

              {/* Node Limit Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Limit: {nodeLimit}</span>
                <input 
                  type="range" 
                  min="25" 
                  max="500" 
                  step="25" 
                  value={nodeLimit} 
                  onChange={(e) => setNodeLimit(Number(e.target.value))}
                  style={{ width: '90px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Live Search Input */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="ค้นหาโหนดคีย์เวิร์ด..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '5px 10px 5px 30px',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    width: '150px'
                  }}
                />
                {searchQuery && (
                  <X 
                    size={12} 
                    onClick={() => setSearchQuery('')} 
                    style={{ position: 'absolute', right: '8px', cursor: 'pointer', color: 'var(--text-muted)' }} 
                  />
                )}
              </div>
            </div>

            {/* Main Graph Canvas & Side Panel Container */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 320px' : '1fr', gap: '16px', transition: 'all 0.3s ease' }}>
              
              {/* Interactive Vis-Network Canvas */}
              <div className="graph-preview" style={{ height: '600px', position: 'relative', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                {graphLoading && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '16px', background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                    <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--primary)' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>กำลังดึงโครงสร้างกราฟและประมวลผลมุมมองภาพ...</span>
                  </div>
                )}
                
                {!graphLoading && graphData.nodes?.length === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px' }}>
                    <HelpCircle size={40} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ยังไม่มีข้อมูลในระบบฐานข้อมูลกราฟในขณะนี้ กรุณานำเข้าไฟล์เอกสารที่หน้า Ingestion</span>
                  </div>
                )}

                <div ref={visJsRef} style={{ width: '100%', height: '100%' }} />
              </div>

              {/* Node Details Side Panel (Glassmorphic Drawer) */}
              {selectedNode && (
                <div className="glass-panel animate-slideup" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)' }}>
                  
                  {/* Panel Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                    <div>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 600, 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: selectedNode.type === 'Entity' ? 'rgba(0, 242, 254, 0.15)' : (selectedNode.type === 'Definition' ? 'rgba(161, 140, 209, 0.15)' : 'rgba(255, 255, 255, 0.1)'),
                        color: selectedNode.type === 'Entity' ? 'var(--primary)' : (selectedNode.type === 'Definition' ? 'var(--accent)' : '#fff')
                      }}>
                        {selectedNode.type}
                      </span>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '8px', color: '#fff', wordBreak: 'break-word' }}>
                        {selectedNode.label}
                      </h4>
                    </div>
                    <button 
                      onClick={() => setSelectedNode(null)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Node Metadata / Properties */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', maxHeight: '200px', overflowY: 'auto' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>คุณสมบัติ (Properties):</span>
                    {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 ? (
                      Object.entries(selectedNode.properties).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 500 }}>{key}:</span>
                          <span style={{ color: '#cbd5e1', fontSize: '0.75rem', wordBreak: 'break-word' }}>
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>ไม่มีคุณสมบัติเพิ่มเติม</span>
                    )}
                  </div>

                  {/* Connected Relationships List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', flex: 1, overflowY: 'auto' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      โหนดที่เชื่อมโยง ({selectedNode.neighbors?.length || 0}):
                    </span>
                    {selectedNode.neighbors && selectedNode.neighbors.length > 0 ? (
                      selectedNode.neighbors.map((nb, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.75rem' }}>
                          <span style={{ color: '#f8fafc', fontWeight: 500 }}>{nb.label}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>
                            {nb.type}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>ไม่มีความสัมพันธ์ตรงในขอบเขตนี้</span>
                    )}
                  </div>

                  {/* Quick Action: RAG Query Shortcut */}
                  <button 
                    onClick={() => handleQueryNodeRAG(selectedNode)}
                    className="primary-btn"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', borderRadius: '8px', marginTop: 'auto' }}
                  >
                    <Sparkles size={14} />
                    <span>ถาม RAG เจาะจงโหนดนี้</span>
                  </button>

                </div>
              )}
            </div>
            
            {/* Visualizer Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="glass-panel" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(230, 92, 0, 0.1)', border: '1px solid rgba(230, 92, 0, 0.5)', display: 'inline-block' }}></span>
                <span>Document Summary Node (Trinity Summary)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="glass-panel" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.4)', display: 'inline-block' }}></span>
                <span>Top Level: Clinical Document / Chunk</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid var(--primary)', display: 'inline-block', boxShadow: '0 0 4px var(--primary)' }}></span>
                <span>Medium Level: Extracted Medical Entity</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(161, 140, 209, 0.1)', border: '1px solid var(--accent)', display: 'inline-block', boxShadow: '0 0 4px rgba(161, 140, 209, 0.3)' }}></span>
                <span>Bottom Level: Dictionary Definition (MeSH/UMLS)</span>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
