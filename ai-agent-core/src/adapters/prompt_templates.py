class PromptTemplates:
    # Prompt cho Explanation Adapter: Tập trung vào phương pháp Socratic (gợi mở)
    EXPLANATION_TEMPLATE = """Explain the English concept of "{topic}" to a student using the Socratic method.

## Context from textbook (USE THIS as your knowledge source):
{context}

## Student Information:
- Current mastery state: {student_state}
- State meaning:
  - "beginning" / "Weak": Student has little understanding → use very simple Vietnamese, give basic definitions, use relatable examples
  - "learning" / "Learning": Student has partial understanding → ask guiding questions, point out patterns
  - "reviewing" / "Mastered": Student is reviewing → reinforce with edge cases, compare similar concepts

## Response Structure:
1. **Greeting & Topic intro** (1 sentence): Briefly introduce what this concept is about
2. **Core explanation** (2-3 sentences): Explain the rule/pattern using the Context, with a clear example
3. **Guiding question** (1 sentence): Ask a specific question that tests understanding — e.g., "Em thử điền vào chỗ trống: 'She ___ (go) to school yesterday.' nhé?"
4. **Encouragement** (1 sentence): End with motivation

## IMPORTANT:
- Do NOT give the answer to your guiding question
- Base ALL explanations on the provided Context — do not invent rules
- If Context is empty or irrelevant, explain the concept using standard English grammar rules
- Use simple, clear Vietnamese appropriate for the student's level"""

    # Prompt cho Quiz Adapter: Yêu cầu nghiêm ngặt về định dạng JSON và độ khó IRT
    QUIZ_TEMPLATE = """Generate a multiple-choice question (MCQ) about: {topic}

## Difficulty
Target IRT Beta: {difficulty}
Difficulty Guide:
  - Beta ≤ -2.0: Very Easy — basic vocabulary, simple present tense, common phrases
  - -2.0 < Beta ≤ -1.0: Easy — simple grammar (articles, prepositions), everyday vocabulary
  - -1.0 < Beta ≤ 0.0: Medium-Easy — intermediate grammar (tenses, conjunctions), academic vocabulary
  - 0.0 < Beta ≤ 1.0: Medium-Hard — complex grammar (conditionals, passive voice), nuanced word choice
  - 1.0 < Beta ≤ 2.0: Hard — advanced grammar (subjunctive, inversion), idiomatic expressions
  - Beta > 2.0: Very Hard — subtle distinctions, formal/academic register, rare constructions

## Context from textbook (USE THIS as the basis for your question):
{context}

## Requirements for each field:

### "question"
- A natural English sentence with ONE blank represented as ___ (three underscores)
- The blank should test exactly ONE grammar/vocabulary point
- The sentence must have enough context to determine the single correct answer

### "options"
- Exactly 4 options labeled A, B, C, D
- ONE and ONLY ONE option is correct
- The 3 distractors (wrong options) must be:
  (a) Plausible — a student at this level might choose them
  (b) Clearly wrong for a specific grammatical/semantic reason
  (c) Distinct from each other (not synonyms of each other)
- Common distractor strategies: wrong tense, wrong part of speech, wrong preposition, wrong article, commonly confused words

### "correct_answer"
- Must be EXACTLY one of: "A", "B", "C", "D"
- Must correspond to the option that is grammatically and semantically correct in the sentence
- VERIFY: mentally substitute the correct option into the blank and confirm it forms a valid sentence

### "explanation"
- Write in VIETNAMESE
- Structure: "[Đáp án đúng] là [X] vì [grammar/vocabulary rule]. [Giải thích ngắn tại sao các đáp án khác sai]."
- Must reference the specific grammar rule or vocabulary usage
- Keep it 1-3 sentences

## SELF-CHECK before responding:
1. Does the correct option fit perfectly in the blank?
2. Are ALL other options clearly wrong?
3. Does the difficulty match the target Beta?
4. Is the explanation in Vietnamese and accurate?

## Output format (JSON only):
{{
    "question": "sentence with ___ blank",
    "options": {{
        "A": "option A text",
        "B": "option B text",
        "C": "option C text",
        "D": "option D text"
    }},
    "correct_answer": "A or B or C or D",
    "explanation": "Vietnamese explanation with grammar rule",
    "difficulty_level": {difficulty}
}}"""

    # Prompt cho việc phân tích lỗi sai (Grader)
    GRADER_TEMPLATE = """Analyze why the student chose the wrong answer and help them understand the correct one.

## Context from textbook (USE THIS as reference if provided):
{context}

## Question:
{question}

## Correct Answer: {correct_answer}
## Student's Answer: {student_answer}

## Response Structure (in Vietnamese):
1. **Acknowledge** (1 sentence): "Em đã chọn [student_answer], nhưng đáp án đúng là [correct_answer]."
2. **Explain the error** (1-2 sentences): Identify the SPECIFIC grammar/vocabulary mistake — e.g., wrong tense, wrong preposition, confused words. Name the grammar rule.
3. **Explain correct answer** (1-2 sentences): Why the correct answer is right — reference the rule and show how it applies to this sentence.
4. **Quick tip** (1 sentence): A memorable tip to avoid this mistake in the future.

## IMPORTANT:
- Focus ONLY on this specific question — do not add unrelated grammar lessons
- If the student's answer and correct answer are the same, congratulate them instead
- Use simple Vietnamese appropriate for a language learner"""

    BATCH_QUIZ_TEMPLATE = """Generate a list of {num_questions} multiple-choice questions (MCQs) in Vietnamese about the topic: "{topic}".

## Target Difficulty: {difficulty}

## Context/Materials (Use this as your primary information source if provided):
{context}

## Additional User Requirements/Instructions (Follow these if provided):
{user_prompt}

## Requirements for each question:
1. **question**: A clear, natural question or sentence with blank space in Vietnamese.
2. **options**: Exactly 4 options. Each option must have a clear text.
3. **correct_answer**: Must exactly match the text of the single correct option.
4. **explanation**: A concise explanation in Vietnamese explaining why the correct option is right and others are wrong.
5. **difficulty**: The difficulty of the question ("easy", "medium", "hard").

## Output format (JSON only):
Produce a JSON object matching this exact structure:
{{
  "questions": [
    {{
      "question": "Nội dung câu hỏi...",
      "type": "mcq",
      "difficulty": "{difficulty}",
      "options": [
        {{ "text": "Đáp án A", "isCorrect": true }},
        {{ "text": "Đáp án B", "isCorrect": false }},
        {{ "text": "Đáp án C", "isCorrect": false }},
        {{ "text": "Đáp án D", "isCorrect": false }}
      ],
      "explanation": "Giải thích chi tiết bằng tiếng Việt..."
    }},
    ...
  ]
}}
Verify that there is EXACTLY one correct option (isCorrect: true) per question. Do NOT include any extra text, markdown code blocks, or preamble outside of the JSON object.
"""