# src/adapters/llm_manager.py

import torch
from unsloth import FastLanguageModel
from peft import PeftModel

class LLMManager:
    def __init__(self, base_model_path, adapter_paths, max_seq_length=2048):
        """
        base_model_path: Đường dẫn tới mô hình đã được quantize 4-bit (ví dụ: "unsloth/llama-3-8b-bnb-4bit")
        adapter_paths: Dict chứa đường dẫn các adapter {'explanation': 'path/to/exp', 'quiz': 'path/to/quiz'}
        """
        self.base_model_path = base_model_path
        self.adapter_paths = adapter_paths
        self.max_seq_length = max_seq_length
        self.tokenizer = None
        self.model = None
        self.current_adapter = None

        self._load_unsloth_model()
        self._preload_adapters()

    def _load_unsloth_model(self):
        print("Loading base model with Unsloth (4-bit)...")
        # Unsloth load mô hình và tokenizer cực nhanh
        self.model, self.tokenizer = FastLanguageModel.from_pretrained(
            model_name = self.base_model_path,
            max_seq_length = self.max_seq_length,
            load_in_4bit = True,
            # dtype = None (tự động chọn bfloat16 nếu GPU hỗ trợ)
        )
        
        # Bật chế độ inference để tăng tốc độ sinh văn bản
        FastLanguageModel.for_inference(self.model)

    def _preload_adapters(self):
        """
        Load tất cả các adapter vào bộ nhớ ngay từ đầu để việc switch 
        giữa 'quiz' và 'explanation' diễn ra tức thời (miliseconds).
        """
        print("Pre-loading adapters into VRAM...")
        for name, path in self.adapter_paths.items():
            # Load adapter vào mô hình
            self.model.load_adapter(path, adapter_name=name)
            print(f"Loaded adapter: {name}")

    def set_adapter(self, adapter_name):
        """Switch nhanh giữa các adapter đã load"""
        if adapter_name not in self.adapter_paths:
            raise ValueError(f"Adapter {adapter_name} not found in config.")
        
        if self.current_adapter == adapter_name:
            return

        print(f"Switching to adapter: {adapter_name}...")
        self.model.set_adapter(adapter_name)
        self.current_adapter = adapter_name

    def generate(self, prompt, max_new_tokens=512, temperature=0.7):
        # Tokenize input
        inputs = self.tokenizer([prompt], return_tensors="pt").to("cuda")
        
        # Unsloth tối ưu hóa việc generate thông qua FastLanguageModel.for_inference
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs, 
                max_new_tokens=max_new_tokens, 
                temperature=temperature,
                do_sample=True if temperature > 0 else False,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        # Giải mã và loại bỏ phần prompt ban đầu
        decoded = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        return decoded[len(prompt):].strip()