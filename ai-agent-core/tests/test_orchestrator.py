import unittest
from eduboost_agent.learning.orchestrator import AgentOrchestrator
from eduboost_agent.learning.config import BKT_MASTERY_THRESHOLD

class TestAgentOrchestrator(unittest.TestCase):
    def setUp(self):
        # Khởi tạo orchestrator cho học sinh test
        self.orchestrator = AgentOrchestrator(student_id="test_user")

    def test_decide_explain(self):
        """Kiểm tra ra quyết định GIẢNG BÀI khi P(L) thấp"""
        self.orchestrator.skills["grammar"] = 0.2 # Weak
        decision = self.orchestrator.decide_next_action("grammar")
        self.assertEqual(decision["action"], "EXPLAIN")
        self.assertEqual(decision["adapter"], "explanation_adapter")

    def test_decide_quiz(self):
        """Kiểm tra ra quyết định LUYỆN TẬP khi P(L) trung bình"""
        self.orchestrator.skills["grammar"] = 0.6 # Learning
        self.orchestrator.irt.theta = 0.5 # Năng lực trung bình
        decision = self.orchestrator.decide_next_action("grammar")
        self.assertEqual(decision["action"], "QUIZ")
        self.assertEqual(decision["params"]["beta"], 0.5)

    def test_decide_next_skill(self):
        """Kiểm tra ra quyết định CHUYỂN BÀI khi P(L) cao"""
        self.orchestrator.skills["grammar"] = BKT_MASTERY_THRESHOLD  # Mastered
        decision = self.orchestrator.decide_next_action("grammar")
        self.assertEqual(decision["action"], "NEXT_SKILL")

    def test_full_update_flow(self):
        """Kiểm tra luồng cập nhật trạng thái tổng thể"""
        skill = "grammar"
        beta = 0.0
        initial_p = self.orchestrator.skills.get(skill, 0.3)
        initial_theta = self.orchestrator.irt.theta
        
        # Giả lập trả lời đúng
        result = self.orchestrator.update_student_state(skill, beta, is_correct=True)
        
        self.assertGreater(result["new_p"], initial_p)
        self.assertGreater(result["new_theta"], initial_theta)
        self.assertEqual(result["skill"], skill)

if __name__ == "__main__":
    unittest.main()
