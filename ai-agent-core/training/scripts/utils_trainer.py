import yaml
import torch
from pathlib import Path
from unsloth import FastLanguageModel, is_bfloat16_supported
from trl import SFTConfig, SFTTrainer
from transformers import EarlyStoppingCallback
from datasets import load_dataset
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

def load_yaml_config(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def setup_model(model_cfg):
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = model_cfg["base_model"],
        max_seq_length = model_cfg["max_seq_length"],
        load_in_4bit = model_cfg["load_in_4bit"],
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r = model_cfg["lora_r"],
        lora_alpha = model_cfg["lora_alpha"],
        target_modules = model_cfg["target_modules"],
        lora_dropout = 0,
        bias = "none",
    )
    return model, tokenizer

def prepare_dataset(data_file, tokenizer, val_split):
    dataset = load_dataset("json", data_files=data_file, split="train")
    dataset = dataset.train_test_split(test_size=val_split)
    
    def formatting_prompts_func(examples):
        texts = []
        for messages in examples["messages"]:
            texts.append(tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False))
        return { "text": texts }

    train_ds = dataset["train"].map(formatting_prompts_func, batched=True)
    val_ds = dataset["test"].map(formatting_prompts_func, batched=True)
    return train_ds, val_ds

def build_trainer(model, tokenizer, train_ds, val_ds, train_cfg):
    sft_config = SFTConfig(
        output_dir = train_cfg["output_dir"],
        per_device_train_batch_size = train_cfg["batch_size"],
        gradient_accumulation_steps = train_cfg["grad_accum"],
        learning_rate = train_cfg["learning_rate"],
        num_train_epochs = train_cfg["epochs"],
        eval_strategy = "steps",
        eval_steps = train_cfg["eval_steps"],
        save_steps = train_cfg["save_steps"],
        logging_steps = train_cfg["logging_steps"],
        load_best_model_at_end = True,
        metric_for_best_model = "eval_loss",
        bf16 = is_bfloat16_supported(),
        fp16 = not is_bfloat16_supported(),
        dataset_text_field = "text",
        max_seq_length = 2048,
        packing = True,
    )

    callbacks = []
    if train_cfg.get("early_stopping_patience"):
        callbacks.append(EarlyStoppingCallback(
            early_stopping_patience=train_cfg["early_stopping_patience"],
            early_stopping_threshold=train_cfg.get("early_stopping_threshold", 0.0),
        ))

    return SFTTrainer(
        model = model,
        args = sft_config,
        train_dataset = train_ds,
        eval_dataset = val_ds,
        processing_class = tokenizer,
        callbacks = callbacks,
    )

def plot_training_loss(trainer, output_dir, adapter_name):
    """
    Vẽ biểu đồ Training Loss và Validation Loss.
    """
    history = trainer.state.log_history
    
    train_loss = []
    val_loss = []
    train_steps = []
    val_steps = []

    for entry in history:
        if "loss" in entry:
            train_loss.append(entry["loss"])
            train_steps.append(entry["step"])
        if "eval_loss" in entry:
            val_loss.append(entry["eval_loss"])
            val_steps.append(entry["step"])

    plt.figure(figsize=(10, 6))
    sns.set_style("whitegrid")
    
    plt.plot(train_steps, train_loss, label="Training Loss", color="blue", linewidth=2)
    plt.plot(val_steps, val_loss, label="Validation Loss", color="red", marker='o', linewidth=2)
    
    plt.title(f"Learning Curve - {adapter_name} Adapter", fontsize=15)
    plt.xlabel("Steps", fontsize=12)
    plt.ylabel("Loss", fontsize=12)
    plt.legend()
    plt.grid(True)
    
    # Lưu biểu đồ vào thư mục output
    save_path = Path(output_dir) / "loss_curve.png"
    plt.savefig(save_path)
    plt.close()
    print(f"📈 Loss diagram saved to {save_path}")