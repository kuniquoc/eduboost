# src/rag/ingest.py

import os
from PyPDF2 import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from src.rag.vector_db import VectorDB

class RAGIngestor:
    def __init__(self, vector_db: VectorDB):
        self.db = vector_db
        # Cấu hình chia nhỏ văn bản (Chunking)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,        # Mỗi đoạn khoảng 800 ký tự
            chunk_overlap=150,     # Gối đầu 150 ký tự để giữ ngữ cảnh giữa 2 đoạn
            length_function=len,
            separators=["\n\n", "\n", ".", " ", ""] # Ưu tiên chia theo đoạn -> câu -> từ
        )

    def _extract_text_from_pdf(self, pdf_path):
        """Trích xuất text từ file PDF"""
        print(f"Extracting PDF: {pdf_path}...")
        text = ""
        try:
            reader = PdfReader(pdf_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        except Exception as e:
            print(f"Error reading PDF {pdf_path}: {e}")
        return text

    def _extract_text_from_txt(self, txt_path):
        """Trích xuất text từ file TXT với xử lý encoding"""
        print(f"Extracting TXT: {txt_path}...")
        try:
            with open(txt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            with open(txt_path, 'r', encoding='latin-1') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading TXT {txt_path}: {e}")
            return ""

    def process_file(self, file_path):
        """Điều hướng xử lý dựa trên định dạng file"""
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.pdf':
            full_text = self._extract_text_from_pdf(file_path)
        elif ext == '.txt':
            full_text = self._extract_text_from_txt(file_path)
        else:
            print(f"Unsupported format {ext}: {file_path}")
            return

        if not full_text.strip():
            print(f"No content found in {file_path}. Skipping.")
            return

        # Chia nhỏ văn bản thành các chunks
        chunks = self.text_splitter.split_text(full_text)
        print(f"Split {file_path} into {len(chunks)} chunks.")

        # Nạp vào VectorDB
        self.db.add_documents(chunks)
        print(f"Successfully ingested {file_path}.")

    def process_directory(self, directory_path):
        """Quét toàn bộ thư mục raw và nạp tất cả file hợp lệ"""
        if not os.path.exists(directory_path):
            print(f"Directory {directory_path} not found.")
            return

        print(f"Scanning directory: {directory_path}...")
        for filename in os.listdir(directory_path):
            file_path = os.path.join(directory_path, filename)
            if os.path.isfile(file_path):
                self.process_file(file_path)

if __name__ == "__main__":
    # Chạy thử nghiệm nạp dữ liệu
    db = VectorDB() 
    ingestor = RAGIngestor(db)
    ingestor.process_directory("data/raw/")