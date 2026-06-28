import math

class IRTModel:
    """
    Item Response Theory (IRT) - 1PL Model
    Đo lường năng lực học sinh (theta) và độ khó câu hỏi (beta).
    """
    def __init__(self, initial_theta: float = 0.0, learning_rate: float = 0.2):
        self.theta = initial_theta  # Năng lực học sinh (mặc định 0.0 là trung bình)
        self.lr = learning_rate     # Tốc độ cập nhật theta

    def predict_probability(self, beta: float) -> float:
        """
        Tính xác suất trả lời đúng dựa trên năng lực theta và độ khó beta.
        Công thức: P(correct) = 1 / (1 + exp(-(theta - beta)))
        """
        try:
            return 1 / (1 + math.exp(-(self.theta - beta)))
        except OverflowError:
            return 0.0 if self.theta < beta else 1.0

    def update_theta(self, beta: float, is_correct: bool) -> float:
        """
        Cập nhật năng lực theta dựa trên kết quả thực tế.
        Sử dụng phương pháp Gradient Descent đơn giản.
        """
        prob_correct = self.predict_probability(beta)
        actual = 1 if is_correct else 0
        
        # Cập nhật theta: theta_new = theta_old + lr * (thực tế - dự đoán)
        self.theta += self.lr * (actual - prob_correct)
        
        # Giới hạn theta trong khoảng [-3.0, 3.0] để tránh giá trị cực đoan
        self.theta = max(-3.0, min(3.0, self.theta))
        
        return round(self.theta, 4)