"""
Training Script: Sentiment Analysis Model
Fine-tunes DistilBERT for civic complaint sentiment.

Usage:
    python ml/train_sentiment.py

Output:
    ml/weights/sentiment_model/ — Hugging Face model directory

Note: This requires PyTorch and transformers installed.
      For most use cases, the pre-trained model works well.
      Only fine-tune if you have domain-specific labeled data.
"""

import os
import sys
import json

# Check dependencies
try:
    import torch
    from transformers import (
        DistilBertTokenizer,
        DistilBertForSequenceClassification,
        Trainer,
        TrainingArguments,
    )
    from torch.utils.data import Dataset
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False
    print("Missing dependencies. Install: pip install torch transformers")


class SentimentDataset(Dataset):
    """Custom dataset for sentiment training."""

    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.encodings = tokenizer(
            texts, truncation=True, padding=True, max_length=max_length, return_tensors="pt"
        )
        self.labels = torch.tensor(labels)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        item = {key: val[idx] for key, val in self.encodings.items()}
        item["labels"] = self.labels[idx]
        return item


def generate_sentiment_data():
    """Generate civic sentiment training data."""

    positive = [
        "Thank you for fixing the road so quickly",
        "The garbage collection has improved a lot",
        "Hospital services are much better now",
        "Water supply is regular and clean",
        "New streetlights make our area safer",
        "Drainage problem resolved within 2 days, excellent service",
        "Very happy with the fast response from ward office",
        "Road repair done properly, thank you MLA",
        "Clean drinking water now available, great improvement",
        "Community park renovated beautifully",
        "School building repainted and looks great",
        "Public toilet cleaned regularly now",
        "New bridge construction is excellent quality work",
        "Traffic management improved significantly",
        "Quick ambulance response saved lives",
    ]

    negative = [
        "Roads are terrible, potholes everywhere",
        "No water supply for the third day in a row",
        "Garbage dump creating unbearable stench",
        "Hospital has no medicines or doctors",
        "Complete darkness at night, streetlights broken",
        "Sewage overflowing into our homes for weeks",
        "Drainage completely blocked, flooding every monsoon",
        "Fake road repair, contractor did nothing",
        "Water contamination making children sick",
        "Government scheme benefits not reaching poor families",
        "Corruption in public distribution system",
        "No response to repeated complaints about broken road",
        "School infrastructure crumbling dangerously",
        "Power cuts 8 hours daily, no improvement",
        "Crime increasing, police not patrolling area",
    ]

    neutral = [
        "When will the road repair work begin",
        "Information about water supply schedule",
        "Requesting update on garbage collection timing",
        "Need details about new electricity connection",
        "What are the timings for vaccination drive",
        "How to apply for new water connection",
        "Query about property tax payment",
        "Asking about school admission process",
        "Request for birth certificate copy",
        "Information needed about housing scheme",
    ]

    texts = positive + negative + neutral
    # 0=positive, 1=negative, 2=neutral
    labels = [0] * len(positive) + [1] * len(negative) + [2] * len(neutral)

    return texts, labels


def train():
    """Fine-tune DistilBERT for civic sentiment."""

    if not HAS_DEPS:
        print("❌ Cannot train: missing PyTorch or transformers")
        print("   Install: pip install torch transformers")
        return

    print("=" * 50)
    print("  Sentiment Model Training")
    print("=" * 50)

    # Load data
    csv_path = os.path.join(os.path.dirname(__file__), "data", "sentiment_train.csv")
    if os.path.exists(csv_path):
        import pandas as pd
        df = pd.read_csv(csv_path)
        texts = df["text"].tolist()
        labels = df["label"].tolist()
        print(f"Loaded {len(texts)} samples from CSV")
    else:
        texts, labels = generate_sentiment_data()
        print(f"Using synthetic data: {len(texts)} samples")

    # Load tokenizer and model
    model_name = "distilbert-base-uncased"
    print(f"Loading base model: {model_name}")
    tokenizer = DistilBertTokenizer.from_pretrained(model_name)
    model = DistilBertForSequenceClassification.from_pretrained(
        model_name, num_labels=3
    )

    # Create dataset
    dataset = SentimentDataset(texts, labels, tokenizer)

    # Training arguments
    output_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "ml", "weights", "sentiment_model"
    )
    os.makedirs(output_dir, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=5,
        per_device_train_batch_size=8,
        warmup_steps=50,
        weight_decay=0.01,
        logging_steps=10,
        save_strategy="epoch",
        no_cuda=True,  # CPU training
    )

    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
    )

    print("\nTraining...")
    trainer.train()

    # Save
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Save config
    config = {
        "model_name": model_name,
        "num_labels": 3,
        "label_map": {0: "positive", 1: "negative", 2: "neutral"},
        "samples": len(texts),
    }
    with open(os.path.join(output_dir, "training_config.json"), "w") as f:
        json.dump(config, f, indent=2)

    print(f"\n✅ Sentiment model saved to: {output_dir}")
    print(f"   Labels: positive, negative, neutral")
    print(f"   Samples: {len(texts)}")


if __name__ == "__main__":
    train()
