"""
EduBoost AI Agent Core — Central Configuration
Tập trung tất cả constants, thresholds và default values vào một nơi.
"""

# ── BKT (Bayesian Knowledge Tracing) ─────────────────────────────────────────
BKT_INITIAL_KNOWLEDGE = 0.3   # p_l0: Xác suất biết ban đầu
BKT_TRANSITION = 0.1          # p_t:  Xác suất học được sau 1 câu hỏi
BKT_SLIP = 0.1                # p_s:  Xác suất sai dù đã biết
BKT_GUESS = 0.25              # p_g:  Xác suất đúng dù chưa biết

BKT_MASTERY_THRESHOLD = 0.8   # P(L) >= threshold → Mastered
BKT_LEARNING_THRESHOLD = 0.5  # P(L) >= threshold → Learning (else Weak)

# ── IRT (Item Response Theory) ────────────────────────────────────────────────
IRT_DEFAULT_THETA = 0.0        # Năng lực khởi đầu của học sinh
IRT_DISCRIMINATION = 1.0       # Tham số a (phân biệt)
IRT_DIFFICULTY_MIN = -3.0      # Độ khó tối thiểu (logit)
IRT_DIFFICULTY_MAX = 3.0       # Độ khó tối đa (logit)
IRT_DEFAULT_DIFFICULTY = 0.0   # Độ khó mặc định khi khởi tạo

# Adaptive difficulty adjustment
IRT_THETA_STEP_CORRECT = 0.3   # Tăng theta khi trả lời đúng
IRT_THETA_STEP_WRONG = 0.3     # Giảm theta khi trả lời sai

# ── Spaced Repetition (SM-2 based) ───────────────────────────────────────────
SM2_INITIAL_INTERVAL = 1       # Ngày đến lần review đầu tiên
SM2_INITIAL_EASINESS = 2.5     # Hệ số dễ khởi đầu
SM2_MINIMUM_EASINESS = 1.3     # Hệ số dễ tối thiểu
SM2_CORRECT_THRESHOLD = 3      # Điểm chất lượng tối thiểu để tăng interval

# ── Placement / Entry Test ────────────────────────────────────────────────────
PLACEMENT_TEST_MAX_QUESTIONS = 20   # Tối đa câu hỏi placement test
PLACEMENT_TEST_MIN_QUESTIONS = 10   # Tối thiểu câu hỏi placement test
PLACEMENT_TEST_CONFIDENCE_THRESHOLD = 0.8  # Ngưỡng tin cậy để kết thúc sớm

# ── LLM / Quiz Generation ─────────────────────────────────────────────────────
DEFAULT_NUM_QUESTIONS = 5        # Số câu hỏi mặc định mỗi lần generate
MAX_NUM_QUESTIONS = 20           # Giới hạn tối đa câu hỏi một lần generate
DEFAULT_DIFFICULTY = "medium"    # Độ khó mặc định

# Chat / RAG
RAG_TOP_K_DOCS = 5               # Số document chunks lấy từ vector store
RAG_SIMILARITY_THRESHOLD = 0.3   # Ngưỡng similarity tối thiểu
CHAT_MAX_HISTORY = 10            # Số lượt hội thoại tối đa đưa vào context

# ── Timeouts ──────────────────────────────────────────────────────────────────
LLM_TIMEOUT_SECONDS = 120        # Timeout cho LLM calls
VECTOR_SEARCH_TIMEOUT = 10       # Timeout cho vector search
