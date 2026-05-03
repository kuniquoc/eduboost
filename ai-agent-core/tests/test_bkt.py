import unittest
from src.core.bkt import BKTModel

class TestBKTModel(unittest.TestCase):
    def setUp(self):
        self.bkt = BKTModel()

    def test_update_correct(self):
        """Kiểm tra P(L) tăng khi trả lời đúng"""
        initial_p = 0.3
        new_p = self.bkt.update(initial_p, is_correct=True)
        self.assertGreater(new_p, initial_p, "P(L) phải tăng khi trả lời đúng")

    def test_update_wrong(self):
        """Kiểm tra P(L) giảm khi trả lời sai"""
        initial_p = 0.7
        new_p = self.bkt.update(initial_p, is_correct=False)
        self.assertLess(new_p, initial_p, "P(L) phải giảm khi trả lời sai")

    def test_mastery_levels(self):
        """Kiểm tra phân loại mức độ nắm vững"""
        self.assertEqual(self.bkt.get_mastery_level(0.3), "Weak")
        self.assertEqual(self.bkt.get_mastery_level(0.6), "Learning")
        self.assertEqual(self.bkt.get_mastery_level(0.9), "Mastered")

if __name__ == "__main__":
    unittest.main()