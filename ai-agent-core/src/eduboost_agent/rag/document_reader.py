# src/eduboost_agent/rag/document_reader.py

import os
import logging

logger = logging.getLogger(__name__)

class DocumentReader:
    """
    Manages loading and reading of files in various formats (TXT, PDF, DOCX).
    Acts as a single point of truth for text extraction.
    """

    def __init__(self):
        ...

    def read_txt(self, file_path: str) -> str:
        """Read plain text files with UTF-8 and Latin-1 fallback."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            logger.warning("UTF-8 decoding failed for %s. Falling back to Latin-1.", file_path)
            try:
                with open(file_path, "r", encoding="latin-1") as f:
                    return f.read()
            except Exception as e:
                logger.error("Error reading TXT file %s with Latin-1: %s", file_path, e)
                return ""
        except Exception as e:
            logger.error("Error reading TXT file %s: %s", file_path, e)
            return ""

    def read_pdf(self, file_path: str) -> str:
        """Read PDF files, preferring PyMuPDF (fitz) with fallback to PyPDF2."""
        text = ""
        # 1. Try PyMuPDF (fitz)
        try:
            import fitz
            logger.info("Extracting PDF using PyMuPDF: %s", file_path)
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text() + "\n"
            return text
        except ImportError:
            logger.warning("PyMuPDF (fitz) is not installed. Falling back to PyPDF2.")
        except Exception as e:
            logger.warning("PyMuPDF failed to extract %s: %s. Falling back to PyPDF2.", file_path, e)

        # 2. Fallback to PyPDF2
        try:
            from PyPDF2 import PdfReader
            logger.info("Extracting PDF using PyPDF2 fallback: %s", file_path)
            reader = PdfReader(file_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text
        except Exception as e:
            logger.error("All PDF extraction methods failed for %s: %s", file_path, e)
            return ""

    def read_docx(self, file_path: str) -> str:
        """Read DOCX files using python-docx."""
        try:
            import docx
            logger.info("Extracting DOCX using python-docx: %s", file_path)
            doc = docx.Document(file_path)
            text = ""
            for para in doc.paragraphs:
                text += para.text + "\n"
            return text
        except ImportError:
            logger.error("python-docx is not installed. Cannot parse DOCX files.")
            return ""
        except Exception as e:
            logger.error("Error reading DOCX file %s: %s", file_path, e)
            return ""

    def load_document(self, file_path: str) -> str:
        """Detect file extension and load text content accordingly."""
        if not os.path.exists(file_path):
            logger.error("File does not exist: %s", file_path)
            return ""

        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".txt":
            return self.read_txt(file_path)
        elif ext == ".pdf":
            return self.read_pdf(file_path)
        elif ext == ".docx":
            return self.read_docx(file_path)
        else:
            logger.warning("Unsupported file extension %s for %s", ext, file_path)
            return ""
