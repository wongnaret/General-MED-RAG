import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown
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
  
  // Fetch system status on mount
  useEffect(() => {
    fetchStatus();
    fetchGraphData();
    
    // Poll status every 20s
    const interval = setInterval(fetchStatus, 20000);
    return () => clearInterval(interval);
  }, []);

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

  const fetchGraphData = async () => {
    setGraphLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/visualization?limit=100`);
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
        // Refresh graph data in case query populated missing terms
        fetchGraphData();
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
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setIngestStatus('idle');
      setIngestLog('');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleIngestSubmit = async () => {
    if (!selectedFile) return;
    
    setIngestStatus('uploading');
    setIngestLog(`กำลังเริ่มต้นประมวลผล... กำลังอัปโหลดเอกสารเข้าสู่เลเยอร์ ${selectedLayer.toUpperCase()}`);
    
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
        setIngestLog(`สำเร็จ! ประมวลผลและแปลงเนื้อหาเป็น 3D Medical Graph ในเลเยอร์ ${selectedLayer.toUpperCase()} เรียบร้อยแล้ว (GID: ${data.gid.substring(0, 8)}) พร้อมสร้างความสัมพันธ์เชื่อมโยง (Trinity Links) ไปยังเลเยอร์อื่นโดยอัตโนมัติ`);
        setSelectedFile(null);
        // Reload Graph node visualization
        fetchGraphData();
        fetchStatus();
      } else {
        const errorData = await res.json();
        setIngestStatus('error');
        setIngestLog(`ข้อผิดพลาด: ${errorData.detail || 'การสกัดสร้างกราฟล้มเหลว'}`);
      }
    } catch (e) {
      setIngestStatus('error');
      setIngestLog(`ข้อผิดพลาดทางเทคนิค: ${e.message}`);
    }
  };

  return (
    <div className="app-container">
      
      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div>
          <div className="logo-section">
            <span style={{ fontSize: '1.75rem' }}>🩺</span>
            <div>
              <h1 style={{ fontWeight: 800 }}>MED-Graph-RAG</h1>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                ON-PREMISES CLINICAL AI
              </span>
            </div>
          </div>
          
          <nav className="nav-links">
            <div 
              className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={18} />
              <span>Clinical Chat RAG</span>
            </div>
            
            <div 
              className={`nav-item ${activeTab === 'ingest' ? 'active' : ''}`}
              onClick={() => setActiveTab('ingest')}
            >
              <UploadCloud size={18} />
              <span>Ingestion Center</span>
            </div>
            
            <div 
              className={`nav-item ${activeTab === 'graph' ? 'active' : ''}`}
              onClick={() => setActiveTab('graph')}
            >
              <Network size={18} />
              <span>Knowledge Graph</span>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div style={{ padding: '0 8px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Activity size={14} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>System Active (On-Prem)</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            v1.0.0-beta // Submodule Unified
          </span>
        </div>
      </aside>

      {/* 2. MAIN HUB WORKSPACE */}
      <main className="main-content">
        
        {/* TOP STATUS AND HEALTH PANEL */}
        <header className="header-bar">
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {activeTab === 'chat' && 'Clinical Assistant AI'}
              {activeTab === 'ingest' && 'Medical Data Ingestion'}
              {activeTab === 'graph' && 'Hierarchical Knowledge Graph'}
            </h2>
            <p className="title-desc">
              {activeTab === 'chat' && ' ground answers with verified clinical textbooks and patient graphs'}
              {activeTab === 'ingest' && ' offline parser using local EasyOCR for secure, air-gapped data uploads'}
              {activeTab === 'graph' && ' live structural visualization of Triple-Linked Medical Nodes'}
            </p>
          </div>

          {/* Database & LLM Status Badges */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
              <Database size={14} style={{ color: status.databases.neo4j === 'Connected' ? 'var(--primary)' : 'var(--danger)' }} />
              <span>Neo4j: {status.databases.neo4j}</span>
            </div>
            <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
              <Database size={14} style={{ color: status.databases.qdrant === 'Connected' ? 'var(--primary)' : 'var(--danger)' }} />
              <span>Qdrant: {status.databases.qdrant}</span>
            </div>
            <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--success)' }}>
              <Cpu size={14} />
              <span>LLM: {status.system_config?.llm_provider?.toUpperCase() || 'OLLAMA'}</span>
            </div>
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
                    <div>{msg.text}</div>
                    
                    {/* Citations block for Assistant */}
                    {msg.role === 'assistant' && msg.matched_document && msg.matched_document !== 'N/A' && (
                      <div className="citation-block" style={{ marginTop: '12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>
                          เอกสารอ้างอิงหลัก (Matched Reference Document):
                        </div>
                        <span className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.7rem', display: 'inline-block', background: 'rgba(0, 242, 254, 0.04)' }}>
                          📄 {msg.matched_document}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                
                {chatLoading && (
                  <div className="message-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <RefreshCw size={14} style={{ animation: 'spin 2s linear infinite' }} />
                    <span>กำลังรันคำนวณ U-Retrieval (ประเมินความพ้องกันของโครงสร้างกราฟและคลังศัพท์แพทย์)...</span>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleQuerySubmit} className="chat-input-bar">
                <input 
                  type="text" 
                  className="chat-input" 
                  placeholder="สอบถามข้อมูลเคส อาการคนไข้ การรักษา หรือสืบค้นโรคแทรกซ้อนร่วม..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" className="button-premium" disabled={chatLoading}>
                  <span>ส่งคำถาม</span>
                </button>
              </form>
            </div>

            {/* RIGHT PANE: Grounding Panel (Dynamic context metadata) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Dynamic definitions / extracted facts from latest response */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} />
                  <span>Clinical Grounding Evidence</span>
                </h3>
                
                {/* 1. Show Local contextual facts */}
                {chatHistory[chatHistory.length - 1]?.retrieved_local_context?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      โครงสร้างความสัมพันธ์หลักในไฟล์ (Local Document Context):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {chatHistory[chatHistory.length - 1].retrieved_local_context.map((c, cIdx) => (
                        <div key={cIdx} className="glass-panel" style={{ padding: '8px 12px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.01)', borderLeft: '3px solid var(--primary)' }}>
                          📝 {c}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ไม่มีความสัมพันธ์ภายในที่ดึงมา หรือกำลังรอป้อนคำถามใหม่
                  </p>
                )}

                {/* 2. Show cross-layer linked references */}
                {chatHistory[chatHistory.length - 1]?.retrieved_link_context?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      การเชื่อมโยงข้ามระดับชั้นข้อมูล (Cross-Layer Reference Linking):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {chatHistory[chatHistory.length - 1].retrieved_link_context.map((l, lIdx) => (
                        <div key={lIdx} className="glass-panel" style={{ padding: '8px 12px', fontSize: '0.75rem', background: 'rgba(161, 140, 209, 0.03)', borderLeft: '3px solid var(--accent)' }}>
                          🔗 {l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Neo4j mini stats graph preview */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Network size={16} style={{ color: 'var(--accent)' }} />
                  <span>On-Premise Database Volumes</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Neo4j Graph Nodes</div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>
                      {graphData.nodes?.length || 0}
                    </div>
                  </div>
                  <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Neo4j Graph Edges</div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--accent)' }}>
                      {graphData.edges?.length || 0}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB 2: DATA INGESTION ==================== */}
        {activeTab === 'ingest' && (
          <div className="dashboard-grid animate-slideup" style={{ gridTemplateColumns: '1.1fr 0.9fr' }}>
            
            {/* Ingestion Input and upload area */}
            <div className="glass-panel ingest-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Ingestion Center</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  อัปโหลดเวชระเบียนผู้ป่วย, แนวทางแนวเวชปฏิบัติ (Guidelines), หรือตำราการแพทย์ (Medical Dictionaries) เพื่อแปลงเป็นความสัมพันธ์กราฟอัจฉริยะ 3 ระดับ
                </p>
              </div>

              {/* TRINITY LAYER SELECTION dropdown panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} style={{ color: 'var(--primary)' }} />
                  <span>ชั้นเป้าหมายในการเก็บข้อมูล (Target Trinity Layer):</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select 
                    value={selectedLayer}
                    onChange={(e) => setSelectedLayer(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      appearance: 'none',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="top" style={{ background: '#0a0a0f' }}>Top Layer: Patient Case Reports / EHR Records</option>
                    <option value="middle" style={{ background: '#0a0a0f' }}>Middle Layer: Clinical Guidelines / Textbooks</option>
                    <option value="bottom" style={{ background: '#0a0a0f' }}>Bottom Layer: Medical Dictionary (MeSH / UMLS)</option>
                  </select>
                  <ChevronDown size={16} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Hidden file input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".pdf,.epub,.txt,.md"
                onChange={handleFileChange}
              />

              {/* Drag drop area */}
              <div className="dropzone" onClick={triggerFileInput} style={{ flex: 1, minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <UploadCloud size={44} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                {selectedFile ? (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{selectedFile.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>คลิกหรือลากเอกสารที่ต้องการวิเคราะห์มาวางตรงนี้</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      รองรับไฟล์ประเภท PDF, EPUB, TXT, MD
                    </p>
                  </div>
                )}
              </div>

              {/* Process action buttons */}
              <button 
                className="button-premium" 
                style={{ width: '100%', padding: '14px', borderRadius: '8px' }}
                onClick={handleIngestSubmit}
                disabled={!selectedFile || ingestStatus === 'uploading'}
              >
                <span>เริ่มระบบวิเคราะห์ และ เชื่อมความสัมพันธ์ระดับชั้น</span>
              </button>
            </div>

            {/* Ingestion logs and specs tracking */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} />
                  <span>Pipeline Logs</span>
                </h4>
                
                <div className="glass-panel" style={{ 
                  flex: 1, 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '16px', 
                  fontFamily: 'monospace', 
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  overflowY: 'auto',
                  lineHeight: 1.5,
                  minHeight: '260px'
                }}>
                  {ingestLog ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ingestStatus === 'uploading' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                          <RefreshCw size={12} style={{ animation: 'spin 2s linear infinite' }} />
                          <span>{ingestLog}</span>
                        </div>
                      )}
                      {ingestStatus === 'success' && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--success)' }}>
                          <CheckCircle2 size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span>{ingestLog}</span>
                        </div>
                      )}
                      {ingestStatus === 'error' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                          <AlertTriangle size={12} />
                          <span>{ingestLog}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>พร้อมรับไฟล์อัปโหลด เพื่อเริ่มการประมวลผลทางการแพทย์...</span>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================== TAB 3: KNOWLEDGE GRAPH VISUALIZER ==================== */}
        {activeTab === 'graph' && (
          <div className="glass-panel animate-slideup" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>ความสัมพันธ์ขององค์ประกอบแพทย์ใน Neo4j (Triple-Graph Structure)</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  แสดงความสัมพันธ์ระหว่าง 3 ชั้นข้อมูล: Chunks เอกสารสีขาว (Top) ➜ คีย์เวิร์ดอาการและพยาธิสภาพสีฟ้า (Medium) ➜ คำนิยามคลังคำศัพท์ UMLS สีม่วง (Bottom)
                </p>
              </div>
              <button 
                onClick={fetchGraphData} 
                className="glass-panel" 
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                disabled={graphLoading}
              >
                <RefreshCw size={14} style={{ animation: graphLoading ? 'spin 2s linear infinite' : 'none' }} />
                <span>รีเฟรชข้อมูลกราฟ</span>
              </button>
            </div>

            {/* Custom SVG Graph Renderer - Premium and highly stable */}
            <div className="graph-preview" style={{ height: '550px' }}>
              {graphLoading ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '16px', background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                  <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--primary)', alignSelf: 'center' }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>กำลังดึงโครงสร้างกราฟและประมวลผลมุมมองภาพ...</span>
                </div>
              ) : graphData.nodes?.length === 0 ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px' }}>
                  <HelpCircle size={40} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ยังไม่มีข้อมูลในระบบฐานข้อมูลกราฟในขณะนี้ กรุณานำเข้าไฟล์เอกสารที่หน้า Ingestion</span>
                </div>
              ) : (
                <svg width="100%" height="100%" style={{ cursor: 'grab' }}>
                  {/* Lines/Edges */}
                  {graphData.edges?.map((edge, idx) => {
                    const sourceNode = graphData.nodes.find(n => n.id === edge.source);
                    const targetNode = graphData.nodes.find(n => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;
                    
                    // Simple deterministic coordinate assignment based on index to prevent overlap and render nice levels
                    const sX = 150 + (graphData.nodes.indexOf(sourceNode) * 110) % 900;
                    const sY = sourceNode.type === 'Chunk' || sourceNode.type === 'Summary' ? 100 : (sourceNode.type === 'Entity' ? 280 : 450);
                    const tX = 150 + (graphData.nodes.indexOf(targetNode) * 110) % 900;
                    const tY = targetNode.type === 'Chunk' || targetNode.type === 'Summary' ? 100 : (targetNode.type === 'Entity' ? 280 : 450);
                    
                    return (
                      <g key={idx}>
                        <line 
                          x1={sX} y1={sY} 
                          x2={tX} y2={tY} 
                          stroke="rgba(255,255,255,0.08)" 
                          strokeWidth="1.5"
                        />
                        <text 
                          x={(sX + tX) / 2} y={(sY + tY) / 2 - 4} 
                          fontSize="8" fill="var(--text-muted)" 
                          textAnchor="middle"
                        >
                          {edge.type}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Nodes */}
                  {graphData.nodes?.map((node, idx) => {
                    const x = 150 + (idx * 110) % 900;
                    const y = node.type === 'Chunk' || node.type === 'Summary' ? 100 : (node.type === 'Entity' ? 280 : 450);
                    
                    const isDocSummary = node.type === 'Summary';
                    const isChunk = node.type === 'Chunk';
                    const isEntity = node.type === 'Entity';
                    const isDefinition = node.type === 'Definition';
                    
                    let fillColor = 'var(--bg-surface)';
                    let strokeColor = 'rgba(255,255,255,0.2)';
                    let glow = 'none';
                    
                    if (isChunk || isDocSummary) {
                      fillColor = isDocSummary ? 'rgba(230, 92, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)';
                      strokeColor = isDocSummary ? 'rgba(230, 92, 0, 0.5)' : 'rgba(255, 255, 255, 0.4)';
                    } else if (isEntity) {
                      fillColor = 'rgba(0, 242, 254, 0.1)';
                      strokeColor = 'var(--primary)';
                      glow = '0 0 10px var(--primary-glow)';
                    } else if (isDefinition) {
                      fillColor = 'rgba(161, 140, 209, 0.1)';
                      strokeColor = 'var(--accent)';
                      glow = '0 0 10px rgba(161, 140, 209, 0.3)';
                    }

                    return (
                      <g key={node.id} transform={`translate(${x}, ${y})`}>
                        <circle 
                          r={isDocSummary ? 22 : (isChunk ? 20 : (isEntity ? 24 : 18))} 
                          fill={fillColor} 
                          stroke={strokeColor} 
                          strokeWidth="2"
                          style={{ filter: glow !== 'none' ? `drop-shadow(${glow})` : 'none' }}
                        />
                        <text 
                          y="40" 
                          fontSize="10" 
                          fill="var(--text-primary)" 
                          fontWeight="500" 
                          textAnchor="middle"
                          style={{ fontFamily: 'var(--font-heading)' }}
                        >
                          {node.label.length > 18 ? node.label.substring(0, 15) + '...' : node.label}
                        </text>
                        <text 
                          y="52" 
                          fontSize="8" 
                          fill="var(--text-muted)" 
                          textAnchor="middle"
                        >
                          ({node.type})
                        </text>
                        <text
                          y="4"
                          fontSize="12"
                          textAnchor="middle"
                        >
                          {isDocSummary && '📚'}
                          {isChunk && '📄'}
                          {isEntity && '🩺'}
                          {isDefinition && '📖'}
                        </text>
                      </g>
                    );
                  })}
                </svg>
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
