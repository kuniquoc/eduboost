import unittest

from src.api.main import (
    _build_avoid_texts,
    _build_retry_hint,
    _is_duplicate_question,
    _is_exact_duplicate,
    _normalize_question_text,
    _parse_single_question,
    _resolve_correct_letter,
    _seed_seen_from_existing,
    _split_context_blob,
)


_OPTIONS_DICT = {
    "A": "has",
    "B": "have",
    "C": "having",
    "D": "had",
}


class TestNormalizeQuestionText(unittest.TestCase):
    def test_strips_punctuation_and_whitespace(self):
        self.assertEqual(
            _normalize_question_text("The cat ___ on the mat."),
            "thecatonthemat",
        )

    def test_case_insensitive(self):
        self.assertEqual(
            _normalize_question_text("SHE ___ TO SCHOOL"),
            _normalize_question_text("she ___ to school"),
        )


class TestIsDuplicateQuestion(unittest.TestCase):
    def test_detects_exact_duplicate(self):
        seen = {_normalize_question_text("She ___ to school every day.")}
        self.assertTrue(_is_duplicate_question("She ___ to school every day.", seen))

    def test_different_questions_not_duplicate(self):
        seen = {_normalize_question_text("She ___ to school every day.")}
        self.assertFalse(_is_duplicate_question("He ___ to work every day.", seen))

    def test_exact_duplicate_same_norm_different_punctuation(self):
        seen = {_normalize_question_text("She ___ to school every day.")}
        self.assertTrue(_is_exact_duplicate("She ___ to school every day!", seen))

    def test_policy_paraphrases_are_not_exact_duplicates(self):
        q1 = "The new policy will ___ a significant change in the way we work."
        q2 = "The new policy will ___ the way we work."
        seen = {_normalize_question_text(q1)}
        self.assertFalse(_is_exact_duplicate(q2, seen))

    def test_new_law_vs_new_policy_not_exact_duplicate(self):
        seen = {_normalize_question_text("The new law will ___ a major impact on businesses.")}
        self.assertFalse(
            _is_exact_duplicate("The new policy will ___ the way we work.", seen)
        )


class TestBuildAvoidTexts(unittest.TestCase):
    def test_merges_completed_and_rejected(self):
        completed = [{"question": "Question A"}]
        rejected = ["Question B", "Question C"]
        self.assertEqual(
            _build_avoid_texts(completed, rejected),
            ["Question A", "Question B", "Question C"],
        )

    def test_truncates_when_over_cap_keeps_rejected(self):
        completed = [{"question": f"Completed {i}"} for i in range(30)]
        rejected = ["Rejected exact dup"]
        result = _build_avoid_texts(completed, rejected)
        self.assertIn("Rejected exact dup", result)
        self.assertLessEqual(len(result), 21)


class TestBuildRetryHint(unittest.TestCase):
    def test_no_hint_on_first_attempt(self):
        self.assertEqual(_build_retry_hint(1, ["The new law will ___"]), "")

    def test_attempt_three_includes_forbidden_prefixes(self):
        hint = _build_retry_hint(3, ["The new policy will ___ change."])
        self.assertIn("the new...", hint.lower())


class TestSplitContextBlob(unittest.TestCase):
    def test_splits_on_double_newline(self):
        blob = "Chunk one.\n\nChunk two.\n\nChunk three."
        self.assertEqual(_split_context_blob(blob), ["Chunk one.", "Chunk two.", "Chunk three."])

    def test_single_paragraph_returns_one_chunk(self):
        self.assertEqual(_split_context_blob("Only one chunk."), ["Only one chunk."])


class TestSeedSeenFromExisting(unittest.TestCase):
    def test_seeds_two_distinct_questions(self):
        seen, placeholders = _seed_seen_from_existing([
            "She ___ to school every day.",
            "He ___ to work every day.",
        ])
        self.assertEqual(len(seen), 2)
        self.assertEqual(len(placeholders), 2)
        self.assertEqual(placeholders[0]["question"], "She ___ to school every day.")

    def test_deduplicates_same_norm_different_punctuation(self):
        seen, placeholders = _seed_seen_from_existing([
            "She ___ to school every day.",
            "She ___ to school every day!",
        ])
        self.assertEqual(len(seen), 1)
        self.assertEqual(len(placeholders), 1)

    def test_avoid_texts_include_seeded_questions(self):
        _, placeholders = _seed_seen_from_existing(["Question A", "Question B"])
        self.assertEqual(
            _build_avoid_texts(placeholders, []),
            ["Question A", "Question B"],
        )

    def test_skips_empty_strings(self):
        seen, placeholders = _seed_seen_from_existing(["", "  ", "Valid ___ question."])
        self.assertEqual(len(seen), 1)
        self.assertEqual(len(placeholders), 1)


class TestResolveCorrectLetter(unittest.TestCase):
    def test_letter_uppercase(self):
        self.assertEqual(_resolve_correct_letter("B", _OPTIONS_DICT), "B")

    def test_letter_lowercase_with_whitespace(self):
        self.assertEqual(_resolve_correct_letter(" b ", _OPTIONS_DICT), "B")

    def test_option_text_match(self):
        self.assertEqual(_resolve_correct_letter("HAVE", _OPTIONS_DICT), "B")
        self.assertEqual(_resolve_correct_letter("have", _OPTIONS_DICT), "B")

    def test_option_prefix_format(self):
        self.assertEqual(_resolve_correct_letter("B.", _OPTIONS_DICT), "B")
        self.assertEqual(_resolve_correct_letter("Option B", _OPTIONS_DICT), "B")

    def test_invalid_answer(self):
        self.assertIsNone(_resolve_correct_letter("xyz", _OPTIONS_DICT))
        self.assertIsNone(_resolve_correct_letter("", _OPTIONS_DICT))


class TestParseSingleQuestion(unittest.TestCase):
    def _base_raw(self, **overrides):
        raw = {
            "question": "The new law will ___ a major impact on businesses.",
            "options": dict(_OPTIONS_DICT),
            "correct_answer": "B",
            "explanation": "Đáp án đúng là have vì...",
        }
        raw.update(overrides)
        return raw

    def test_letter_correct_answer(self):
        parsed = _parse_single_question(self._base_raw(), "easy")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["difficulty"], "easy")
        self.assertEqual(sum(1 for o in parsed["options"] if o["isCorrect"]), 1)
        self.assertTrue(parsed["options"][1]["isCorrect"])

    def test_text_correct_answer(self):
        parsed = _parse_single_question(self._base_raw(correct_answer="HAVE"), "medium")
        self.assertIsNotNone(parsed)
        self.assertTrue(parsed["options"][1]["isCorrect"])

    def test_invalid_correct_answer(self):
        parsed = _parse_single_question(self._base_raw(correct_answer="xyz"), "hard")
        self.assertIsNone(parsed)

    def test_list_options_format(self):
        raw = {
            "question": "She ___ to school every day.",
            "options": [
                {"text": "go", "isCorrect": False},
                {"text": "goes", "isCorrect": True},
                {"text": "going", "isCorrect": False},
                {"text": "gone", "isCorrect": False},
            ],
            "explanation": "Vì chủ ngữ là She...",
        }
        parsed = _parse_single_question(raw, "easy")
        self.assertIsNotNone(parsed)
        self.assertTrue(parsed["options"][1]["isCorrect"])

    def test_prohibited_example_question(self):
        raw = self._base_raw(
            question="The children playing in the garden when it started to rain ___"
        )
        self.assertIsNone(_parse_single_question(raw, "easy"))

    def test_missing_question(self):
        raw = self._base_raw(question="")
        self.assertIsNone(_parse_single_question(raw, "easy"))


if __name__ == "__main__":
    unittest.main()
