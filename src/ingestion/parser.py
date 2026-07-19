import os
import fitz  # PyMuPDF
import easyocr
import numpy as np
from PIL import Image
from typing import List, Dict, Any

class DocumentParser:
    """
    Offline-first Document Parser that extracts text from PDFs and EPUBs.
    If the document contains scanned pages (images), it falls back to local OCR.
    """
    def __init__(self):
        # EasyOCR reader initialized offline for English (and can be extended)
        self.ocr_reader = None

    def _get_ocr_reader(self):
        if self.ocr_reader is None:
            print("[*] Initializing local EasyOCR Reader...")
            self.ocr_reader = easyocr.Reader(['en'], gpu=False)
        return self.ocr_reader

    def parse_pdf(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Parses a PDF file page by page, falling back to OCR if no digital text is found.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        doc = fitz.open(file_path)
        pages_content = []

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text().strip()
            
            # If page is empty or too short, it is likely a scanned image
            if len(text) < 50:
                print(f"[*] Page {page_idx + 1} has very low digital text. Running offline OCR...")
                try:
                    # Render page to high-res image pixmap (DPI 150)
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                    
                    # Convert to RGB if needed (EasyOCR supports RGB numpy arrays)
                    if pix.n == 4: # RGBA
                        img_data = img_data[:, :, :3]
                        
                    reader = self._get_ocr_reader()
                    ocr_results = reader.readtext(img_data, detail=0)
                    text = "\n".join(ocr_results).strip()
                except Exception as e:
                    print(f"  [WARNING] OCR failed on page {page_idx + 1}: {e}")
                    
            pages_content.append({
                "page_num": page_idx + 1,
                "content": text
            })
            
        doc.close()
        return pages_content

    def parse_epub(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Parses EPUB / ebook using PyMuPDF which natively supports EPUB extraction.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        doc = fitz.open(file_path)
        pages_content = []

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text().strip()
            pages_content.append({
                "page_num": page_idx + 1,
                "content": text
            })
            
        doc.close()
        return pages_content

    def parse_document(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Unified router for different formats.
        """
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return self.parse_pdf(file_path)
        elif ext in [".epub", ".mobi"]:
            return self.parse_epub(file_path)
        elif ext in [".txt", ".md"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return [{"page_num": 1, "content": content}]
        else:
            raise ValueError(f"Unsupported file format: {ext}")

class SemanticChunker:
    """
    Chunks document content into overlapping semantically dense chunks.
    """
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_document(self, pages: List[Dict[str, Any]], filename: str) -> List[Dict[str, Any]]:
        chunks = []
        chunk_idx = 0
        
        # Accumulate full text with page markings
        full_text = ""
        page_mappings = [] # Character index ranges to page numbers
        
        for page in pages:
            start_idx = len(full_text)
            full_text += page["content"] + "\n\n"
            end_idx = len(full_text)
            page_mappings.append({
                "start": start_idx,
                "end": end_idx,
                "page_num": page["page_num"]
            })
            
        # Standard sliding window chunker
        ptr = 0
        text_len = len(full_text)
        
        while ptr < text_len:
            end_ptr = min(ptr + self.chunk_size, text_len)
            
            # Try to align chunk end with a sentence or paragraph boundary
            if end_ptr < text_len:
                boundary = full_text.rfind("\n", ptr, end_ptr)
                if boundary == -1 or boundary < ptr + (self.chunk_size // 2):
                    boundary = full_text.rfind(". ", ptr, end_ptr)
                    
                if boundary != -1 and boundary > ptr + (self.chunk_size // 2):
                    end_ptr = boundary + 1

            chunk_text = full_text[ptr:end_ptr].strip()
            
            if len(chunk_text) > 50: # Ignore tiny noise chunks
                # Determine which pages this chunk belongs to
                associated_pages = []
                for mapping in page_mappings:
                    if not (end_ptr <= mapping["start"] or ptr >= mapping["end"]):
                        associated_pages.append(mapping["page_num"])
                
                chunks.append({
                    "chunk_id": f"{filename}_c{chunk_idx}",
                    "document_name": filename,
                    "pages": associated_pages,
                    "content": chunk_text
                })
                chunk_idx += 1
                
            ptr += self.chunk_size - self.chunk_overlap
            
        return chunks

# Singleton parsers
doc_parser = DocumentParser()
semantic_chunker = SemanticChunker()
