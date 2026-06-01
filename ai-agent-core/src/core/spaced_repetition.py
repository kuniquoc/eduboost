"""
Spaced Repetition module implementing the SM-2 algorithm.
Used by the orchestrator to schedule review items.
"""
from datetime import datetime, timedelta
from typing import Dict, Any


class SpacedRepetitionEngine:
    """
    SM-2 (SuperMemo 2) algorithm implementation.
    
    Parameters:
        - quality: Rating of response quality (0-5)
            0: Complete failure
            1: Incorrect, but remembered upon seeing correct answer
            2: Incorrect, but seems easy to recall
            3: Correct with serious difficulty
            4: Correct with some hesitation
            5: Perfect response
        - ease_factor: How easy the item is (starts at 2.5)
        - interval: Days until next review
        - repetitions: Number of consecutive correct responses
    """

    @staticmethod
    def update_after_review(
        quality: int,
        ease_factor: float = 2.5,
        interval: float = 1.0,
        repetitions: int = 0
    ) -> Dict[str, Any]:
        """
        Update spaced repetition parameters after a review.
        
        Args:
            quality: Response quality (0-5)
            ease_factor: Current ease factor
            interval: Current interval in days
            repetitions: Current number of consecutive successes
            
        Returns:
            Dictionary with: new_interval, new_ease_factor, next_review_date, new_repetitions
        """
        quality = max(0, min(5, quality))

        if quality >= 3:
            # Correct response
            if repetitions == 0:
                new_interval = 1.0
            elif repetitions == 1:
                new_interval = 6.0
            else:
                new_interval = interval * ease_factor

            new_repetitions = repetitions + 1
        else:
            # Incorrect response: reset
            new_interval = 1.0
            new_repetitions = 0

        # Update ease factor
        new_ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ease_factor = max(1.3, new_ease_factor)

        next_review_date = datetime.utcnow() + timedelta(days=new_interval)

        return {
            "new_interval": new_interval,
            "new_ease_factor": new_ease_factor,
            "next_review_date": next_review_date.isoformat(),
            "new_repetitions": new_repetitions
        }

    @staticmethod
    def quality_from_response(is_correct: bool, response_time: float = None) -> int:
        """
        Convert a binary correct/incorrect + response time into SM-2 quality (0-5).
        
        Args:
            is_correct: Whether the answer was correct
            response_time: Time taken to respond in seconds (optional)
        """
        if not is_correct:
            return 1  # Incorrect but reviewed

        if response_time is None:
            return 4  # Correct, default to "some hesitation"

        # Fast response = perfect, slow = difficulty
        if response_time < 5:
            return 5  # Perfect
        elif response_time < 15:
            return 4  # Correct with hesitation
        else:
            return 3  # Correct with serious difficulty

    @staticmethod
    def get_review_schedule(items: list) -> list:
        """
        Given a list of spaced repetition items, return items due for review today.
        
        Args:
            items: List of dicts with 'next_review_date' field
            
        Returns:
            List of items due for review, sorted by urgency
        """
        now = datetime.utcnow()
        due_items = []
        
        for item in items:
            review_date = item.get("next_review_date")
            if isinstance(review_date, str):
                review_date = datetime.fromisoformat(review_date)
            
            if review_date and review_date <= now + timedelta(hours=12):
                item["overdue_hours"] = (now - review_date).total_seconds() / 3600
                due_items.append(item)

        # Sort by most overdue first
        due_items.sort(key=lambda x: x.get("overdue_hours", 0), reverse=True)
        return due_items
