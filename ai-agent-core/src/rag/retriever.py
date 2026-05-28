# src/rag/retriever.py

from src.rag.vector_db import VectorDB

class KnowledgeRetriever:
    def __init__(self, vector_db: VectorDB):
        self.db = vector_db

    def get_context(self, topic, query=None):
        """
        Truy xuất kiến thức. 
        Nếu có query (câu hỏi học sinh), dùng query để tìm. 
        Nếu không, dùng topic để tìm kiến thức tổng quát.
        """
        search_query = query if query else topic
        
        # Lấy top 3 đoạn văn bản liên quan nhất (legacy string list)
        docs = self.db.search(search_query, k=3, return_scores=False)
        
        if not docs:
            return "No specific textbook context available for this topic."
        
        # Gộp các đoạn văn bản thành một khối context để đưa vào Prompt
        context = "\n\n".join([f"Source {i+1}: {doc}" for i, doc in enumerate(docs)])
        return context