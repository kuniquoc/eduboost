from training.scripts.utils_trainer import load_yaml_config, setup_model, prepare_dataset, build_trainer, plot_training_loss

def main():
    config = load_yaml_config("training/configs/quiz_config.yaml")
    
    model, tokenizer = setup_model(config["model"])
    train_ds, val_ds = prepare_dataset(config["training"]["data_file"], tokenizer, config["training"]["val_split"])
    
    trainer = build_trainer(model, tokenizer, train_ds, val_ds, config["training"])
    
    print("🚀 Training Quiz Adapter...")
    trainer.train()

    plot_training_loss(trainer, config["training"]["output_dir"], "Quiz")
    
    model.save_pretrained(config["training"]["output_dir"])
    tokenizer.save_pretrained(config["training"]["output_dir"])
    print(f"✅ Saved to {config['training']['output_dir']}")

if __name__ == "__main__":
    main()