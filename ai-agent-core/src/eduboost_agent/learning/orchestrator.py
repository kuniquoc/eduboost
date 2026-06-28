from .bkt import BKTModel
from .irt import IRTModel
from typing import Dict, Any

class AgentOrchestrator:
    """
    Bộ điều phối AI Agent. 
    Kết hợp BKT và IRT để quyết định hành động tiếp theo của gia sư.
    """
    def __init__(self, student_id: str, initial_skills: Dict[str, float] = None):
        self.student_id = student_id
        self.bkt = BKTModel()
        self.irt = IRTModel()
        
        # Quản lý xác suất nắm vững cho nhiều kỹ năng
        # Ví dụ: {"present_simple": 0.3, "present_continuous": 0.3}
        self.skills = initial_skills if initial_skills else {}

    def decide_next_action(self, skill_name: str) -> Dict[str, Any]:
        """
        Phân tích trạng thái học sinh và quyết định hành động của Agent.
        """
        # Lấy xác suất nắm vững của kỹ năng hiện tại (mặc định 0.3 nếu chưa có)
        p_skill = self.skills.get(skill_name, 0.3)
        mastery = self.bkt.get_mastery_level(p_skill)
        
        if mastery == "Weak":
            return {
                "action": "EXPLAIN",
                "adapter": "explanation_adapter",
                "reason": f"Student is weak in {skill_name} (P={p_skill})",
                "params": {}
            }
        
        elif mastery == "Learning":
            # Khi luyện tập, dùng IRT để chọn độ khó beta xấp xỉ theta
            beta_target = self.irt.theta
            return {
                "action": "QUIZ",
                "adapter": "quiz_adapter",
                "reason": f"Student is learning {skill_name} (P={p_skill})",
                "params": {"beta": beta_target}
            }
        
        else: # Mastered
            return {
                "action": "NEXT_SKILL",
                "adapter": None,
                "reason": f"Student has mastered {skill_name}",
                "params": {}
            }

    def update_student_state(self, skill_name: str, beta: float, is_correct: bool) -> Dict[str, Any]:
        """
        Cập nhật toàn bộ trạng thái học sinh sau một câu trả lời.
        """
        # 1. Cập nhật BKT
        current_p = self.skills.get(skill_name, 0.3)
        new_p = self.bkt.update(current_p, is_correct)
        self.skills[skill_name] = new_p
        
        # 2. Cập nhật IRT
        new_theta = self.irt.update_theta(beta, is_correct)
        
        return {
            "student_id": self.student_id,
            "skill": skill_name,
            "new_p": new_p,
            "new_theta": new_theta,
            "mastery": self.bkt.get_mastery_level(new_p)
        }