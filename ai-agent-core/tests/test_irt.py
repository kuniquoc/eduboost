import unittest
from eduboost_agent.learning.irt import IRTModel

class TestIRTModel(unittest.TestCase):
    def setUp(self):
        self.irt = IRTModel(initial_theta=0.0)

    def test_theta_increase(self):
        """Kiểm tra theta tăng khi trả lời đúng câu hỏi khó"""
        beta = 1.0 # Câu khó
        old_theta = self.irt.theta
        new_theta = self.irt.update_theta(beta, is_correct=True)
        self.assertGreater(new_theta, old_theta, "Theta phải tăng khi trả lời đúng")

    def test_theta_decrease(self):
        """Kiểm tra theta giảm khi trả lời sai câu hỏi dễ"""
        beta = -1.0 # Câu dễ
        old_theta = self.irt.theta
        new_theta = self.irt.update_theta(beta, is_correct=False)
        self.assertLess(new_theta, old_theta, "Theta phải giảm khi trả lời sai")

    def test_theta_boundaries(self):
        """Kiểm tra theta không vượt quá giới hạn [-3, 3]"""
        # Giả lập trả lời đúng liên tục 100 câu khó
        for _ in range(100):
            self.irt.update_theta(beta=2.0, is_correct=True)
        self.assertEqual(self.irt.theta, 3.0, "Theta không được vượt quá 3.0")

        # Giả lập trả lời sai liên tục 100 câu dễ
        for _ in range(100):
            self.irt.update_theta(beta=-2.0, is_correct=False)
        self.assertEqual(self.irt.theta, -3.0, "Theta không được thấp hơn -3.0")

if __name__ == "__main__":
    unittest.main()