"""
Step Generate: Gọi API server để sinh responses từ 1 model, lưu ra file.
"""
import json
from .client import create_inference_client, save_json, RESPONSES_DIR


def step_generate(base_url, model_name, test_file, output_file, label="model"):
    """
    Gọi model server sinh responses cho toàn bộ test data.

    Args:
        base_url:    URL server (vd: "http://localhost:8000/v1")
        model_name:  Tên model trên server
        test_file:   Đường dẫn file test (.jsonl, mỗi dòng có "messages")
        output_file: Đường dẫn file output (JSON array)
        label:       Tên hiển thị khi in progress
    """
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    client = create_inference_client(base_url)
    total = len(test_data)
    print(f"  Generating {total} responses from [{label}]...")
    print(f"  Server: {base_url}  |  Model: {model_name}")

    responses = []
    for i, item in enumerate(test_data):
        res = client.chat.completions.create(
            model=model_name,
            messages=item["messages"],
            max_tokens=512,
            temperature=0,
        )
        responses.append(res.choices[0].message.content.strip())

        if (i + 1) % 10 == 0:
            print(f"    Progress: {i+1}/{total}")

    save_json(responses, output_file)
    print(f"  💾 Saved {total} responses → {output_file}")
    return responses


def get_response_path(eval_name, side):
    """Trả về đường dẫn file responses cho 1 eval + side."""
    return RESPONSES_DIR / f"{eval_name}_{side}.json"
