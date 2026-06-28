"""
Adaptive Entry Test module.
Implements an adaptive algorithm to assess student level,
adjusting question difficulty based on responses.
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class EntryTestState:
    """State of an ongoing entry test session."""
    questions_answered: int = 0
    correct_count: int = 0
    current_difficulty: str = "medium"  # "easy" | "medium" | "hard"
    answers: list = field(default_factory=list)
    topic_scores: Dict[str, Dict[str, int]] = field(default_factory=dict)  # {topic_id: {correct: n, total: n}}
    consecutive_correct: int = 0
    consecutive_incorrect: int = 0


class AdaptiveEntryTest:
    """
    Adaptive entry test engine.
    
    Algorithm:
    - Start at medium difficulty
    - 2+ consecutive correct → increase difficulty
    - 2+ consecutive incorrect → decrease difficulty
    - After minimum questions, check stability to determine level
    """

    MIN_QUESTIONS = 1
    MAX_QUESTIONS = 20
    DIFFICULTY_LEVELS = ["easy", "medium", "hard"]

    @staticmethod
    def get_initial_state() -> EntryTestState:
        """Create a new entry test session state."""
        return EntryTestState()

    @staticmethod
    def select_next_difficulty(state: EntryTestState) -> str:
        """
        Determine the next question difficulty based on recent performance.
        """
        if state.consecutive_correct >= 2:
            # Move up
            idx = AdaptiveEntryTest.DIFFICULTY_LEVELS.index(state.current_difficulty)
            new_idx = min(idx + 1, len(AdaptiveEntryTest.DIFFICULTY_LEVELS) - 1)
            return AdaptiveEntryTest.DIFFICULTY_LEVELS[new_idx]
        elif state.consecutive_incorrect >= 2:
            # Move down
            idx = AdaptiveEntryTest.DIFFICULTY_LEVELS.index(state.current_difficulty)
            new_idx = max(idx - 1, 0)
            return AdaptiveEntryTest.DIFFICULTY_LEVELS[new_idx]
        
        return state.current_difficulty

    @staticmethod
    def record_answer(
        state: EntryTestState,
        question_id: str,
        is_correct: bool,
        difficulty: str,
        topic_id: Optional[str] = None
    ) -> EntryTestState:
        """
        Record an answer and update the test state.
        """
        state.questions_answered += 1
        if is_correct:
            state.correct_count += 1
            state.consecutive_correct += 1
            state.consecutive_incorrect = 0
        else:
            state.consecutive_incorrect += 1
            state.consecutive_correct = 0

        state.answers.append({
            "question_id": question_id,
            "is_correct": is_correct,
            "difficulty": difficulty,
            "topic_id": topic_id
        })

        # Track per-topic scores
        if topic_id:
            if topic_id not in state.topic_scores:
                state.topic_scores[topic_id] = {"correct": 0, "total": 0}
            state.topic_scores[topic_id]["total"] += 1
            if is_correct:
                state.topic_scores[topic_id]["correct"] += 1

        # Update difficulty for next question
        state.current_difficulty = AdaptiveEntryTest.select_next_difficulty(state)

        return state

    @staticmethod
    def should_end_test(state: EntryTestState) -> bool:
        """
        Determine if the test should end.
        Ends if max questions reached, or if min reached AND level is stable.
        """
        if state.questions_answered >= AdaptiveEntryTest.MAX_QUESTIONS:
            return True

        if state.questions_answered >= AdaptiveEntryTest.MIN_QUESTIONS:
            # Check stability: last 5 answers should show consistent pattern
            last_5 = state.answers[-5:]
            correct_rate = sum(1 for a in last_5 if a["is_correct"]) / len(last_5)
            return correct_rate >= 0.8 or correct_rate <= 0.2

        return False

    @staticmethod
    def evaluate_result(state: EntryTestState) -> Dict[str, Any]:
        """
        Evaluate final test results and determine student level.
        
        Returns:
            Dictionary with: level, final_score, strengths, weaknesses, bkt_initial_params
        """
        total = state.questions_answered
        if total == 0:
            return {
                "level": "beginner",
                "final_score": 0,
                "strengths": [],
                "weaknesses": [],
                "bkt_initial_params": {}
            }

        overall_score = state.correct_count / total

        # Score by difficulty level
        difficulty_scores = {}
        for diff in AdaptiveEntryTest.DIFFICULTY_LEVELS:
            diff_answers = [a for a in state.answers if a["difficulty"] == diff]
            if diff_answers:
                difficulty_scores[diff] = sum(1 for a in diff_answers if a["is_correct"]) / len(diff_answers)

        # Determine level
        hard_score = difficulty_scores.get("hard", 0)
        medium_score = difficulty_scores.get("medium", 0)

        if hard_score >= 0.7:
            level = "advanced"
        elif medium_score >= 0.6:
            level = "intermediate"
        else:
            level = "beginner"

        # Identify strengths and weaknesses by topic
        strengths = []
        weaknesses = []
        bkt_params = {}

        for topic_id, scores in state.topic_scores.items():
            topic_score = scores["correct"] / scores["total"] if scores["total"] > 0 else 0
            
            if topic_score >= 0.7:
                strengths.append({"topic_id": topic_id, "score": topic_score})
            elif topic_score < 0.5:
                weaknesses.append({"topic_id": topic_id, "score": topic_score})

            # Initialize BKT parameters based on test performance
            bkt_params[topic_id] = {
                "mastery_probability": min(0.9, topic_score * 0.6),  # Cap initial mastery
                "guess_probability": 0.25,
                "slip_probability": 0.1,
                "transition_probability": 0.1
            }

        return {
            "level": level,
            "final_score": round(overall_score * 100, 1),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "bkt_initial_params": bkt_params,
            "difficulty_scores": difficulty_scores
        }
