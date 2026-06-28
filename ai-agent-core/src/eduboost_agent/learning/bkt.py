from typing import Literal

from .config import (
    BKT_GUESS,
    BKT_INITIAL_KNOWLEDGE,
    BKT_LEARNING_THRESHOLD,
    BKT_MASTERY_THRESHOLD,
    BKT_SLIP,
    BKT_TRANSITION,
)

class BKTModel:
    """
    Bayesian Knowledge Tracing (BKT)
    Theo dõi xác suất nắm vững một kỹ năng cụ thể của học sinh.
    """
    def __init__(
        self, 
        p_l0: float = BKT_INITIAL_KNOWLEDGE,
        p_t: float = BKT_TRANSITION,
        p_s: float = BKT_SLIP,
        p_g: float = BKT_GUESS
    ):
        # Tham số cố định dựa trên nghiên cứu AIED
        self.p_l0 = p_l0  # Initial Knowledge: Xác suất biết ban đầu
        self.p_t = p_t    # Transition: Xác suất học được sau 1 câu hỏi
        self.p_s = p_s    # Slip: Xác suất sai dù đã biết
        self.p_g = p_g    # Guess: Xác suất đúng dù chưa biết

    def update(self, current_p: float, is_correct: bool) -> float:
        """
        Cập nhật xác suất nắm vững P(L) dựa trên kết quả trả lời.
        """
        # Bước 1: Observation Update (Cập nhật dựa trên quan sát thực tế)
        if is_correct:
            # P(L | Correct)
            numerator = current_p * (1 - self.p_s)
            denominator = current_p * (1 - self.p_s) + (1 - current_p) * self.p_g
            p_obs = numerator / denominator
        else:
            # P(L | Wrong)
            numerator = current_p * self.p_s
            denominator = current_p * self.p_s + (1 - current_p) * (1 - self.p_g)
            p_obs = numerator / denominator

        # Bước 2: Transition Update (Cập nhật khả năng chuyển đổi trạng thái)
        # Học sinh có thể "ngộ" ra kiến thức sau khi làm bài
        p_next = p_obs + (1 - p_obs) * self.p_t
        
        return round(p_next, 4)

    def get_mastery_level(self, p: float) -> Literal["Weak", "Learning", "Mastered"]:
        """
        Phân loại mức độ nắm vững để Agent ra quyết định hành động.
        """
        if p < BKT_LEARNING_THRESHOLD:
            return "Weak"      # Cần giảng lại (Explanation Adapter)
        elif p < BKT_MASTERY_THRESHOLD:
            return "Learning"  # Cần luyện tập (Quiz Adapter)
        else: 
            return "Mastered"  # Đã thành thạo, chuyển bài mới
