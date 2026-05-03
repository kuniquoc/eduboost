# src/rag/vector_db.py

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import pickle
import os

class VectorDB:
    def __init__(self, model_name='all-MiniLM-L6-v2', index_path='models/vector_db/faiss_index'):
        """
        model_name: Mô hình embedding (nhẹ, nhanh, hiệu quả cho tiếng Anh)
        index_path: Đường dẫn lưu trữ index
        """
        self.embed_model = SentenceTransformer(model_name)
        self.index_path = index_path
        self.index = None
        self.metadata = [] # Lưu nội dung text tương ứng với vector

        # Tạo thư mục lưu trữ nếu chưa có
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        
        # Tự động load index nếu đã tồn tại
        if os.path.exists(index_path + ".bin") and os.path.exists(index_path + ".pkl"):
            self.load_index()

    def add_documents(self, texts):
        """Nhúng văn bản và lưu vào FAISS"""
        if not texts:
            return
            
        embeddings = self.embed_model.encode(texts)
        dimension = embeddings.shape[1]
        
        if self.index is None:
            # IndexFlatL2: Tìm kiếm khoảng cách Euclidean (đơn giản và chính xác cho tập dữ liệu nhỏ/vừa)
            self.index = faiss.IndexFlatL2(dimension)
        
        self.index.add(np.array(embeddings).astype('float32'))
        self.metadata.extend(texts)
        self.save_index()

    def search(self, query, k=3):
        """Tìm kiếm k đoạn văn bản gần nhất với query"""
        if self.index is None:
            print("VectorDB index not loaded. Please run ingest.py first.")
            return []
        
        query_vector = self.embed_model.encode([query])
        distances, indices = self.index.search(np.array(query_vector).astype('float32'), k)
        
        # Trả về danh sách các đoạn text tương ứng với index tìm được
        return [self.metadata[idx] for idx in indices[0] if idx != -1]

    def save_index(self):
        """Lưu index và metadata xuống ổ đĩa"""
        faiss.write_index(self.index, self.index_path + ".bin")
        with open(self.index_path + ".pkl", "wb") as f:
            pickle.dump(self.metadata, f)

    def load_index(self):
        """Load index và metadata từ ổ đĩa"""
        self.index = faiss.read_index(self.index_path + ".bin")
        with open(self.index_path + ".pkl", "rb") as f:
            self.metadata = pickle.load(f)
        print("VectorDB index loaded successfully.")