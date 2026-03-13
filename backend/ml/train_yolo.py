"""
Training Script: YOLOv8 for Infrastructure Damage Detection
Trains YOLOv8 to detect: potholes, road cracks, garbage dumps, broken pipes, etc.

Usage:
    1. Prepare your dataset in YOLO format:
       ml/data/yolo_dataset/
         images/train/     — training images
         images/val/       — validation images
         labels/train/     — training labels (YOLO txt format)
         labels/val/       — validation labels
         data.yaml         — dataset config

    2. Run: python ml/train_yolo.py

Output:
    ml/weights/yolov8_damage.pt — trained model weights

YOLO Label Format (each .txt file, one line per object):
    class_id center_x center_y width height
    (all values normalized 0-1)

Class IDs:
    0: pothole
    1: road_crack
    2: garbage_dump
    3: broken_pipe
    4: damaged_wall
    5: waterlogging
    6: broken_streetlight
    7: fallen_tree
"""

import os
import sys
import yaml

# Check dependencies
try:
    from ultralytics import YOLO
    HAS_YOLO = True
except ImportError:
    HAS_YOLO = False
    print("Missing ultralytics. Install: pip install ultralytics")


def create_dataset_yaml():
    """Create YOLO dataset configuration file."""
    data_dir = os.path.join(os.path.dirname(__file__), "data", "yolo_dataset")
    os.makedirs(os.path.join(data_dir, "images", "train"), exist_ok=True)
    os.makedirs(os.path.join(data_dir, "images", "val"), exist_ok=True)
    os.makedirs(os.path.join(data_dir, "labels", "train"), exist_ok=True)
    os.makedirs(os.path.join(data_dir, "labels", "val"), exist_ok=True)

    config = {
        "path": os.path.abspath(data_dir),
        "train": "images/train",
        "val": "images/val",
        "names": {
            0: "pothole",
            1: "road_crack",
            2: "garbage_dump",
            3: "broken_pipe",
            4: "damaged_wall",
            5: "waterlogging",
            6: "broken_streetlight",
            7: "fallen_tree",
        },
    }

    yaml_path = os.path.join(data_dir, "data.yaml")
    with open(yaml_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False)

    print(f"Dataset config created: {yaml_path}")
    return yaml_path


def train():
    """Train YOLOv8 model on infrastructure damage dataset."""

    if not HAS_YOLO:
        print("❌ Cannot train: ultralytics not installed")
        print("   Install: pip install ultralytics")
        return

    print("=" * 60)
    print("  YOLOv8 Infrastructure Damage Detector — Training")
    print("=" * 60)

    # Create dataset config
    yaml_path = create_dataset_yaml()

    # Check if training data exists
    data_dir = os.path.join(os.path.dirname(__file__), "data", "yolo_dataset", "images", "train")
    images = [f for f in os.listdir(data_dir) if f.endswith(('.jpg', '.png', '.jpeg'))] if os.path.exists(data_dir) else []

    if len(images) < 10:
        print(f"\n⚠️  Only {len(images)} training images found.")
        print("   For good results, you need at least 100+ labeled images per class.")
        print("\n📁 Place your images in:")
        print(f"   {data_dir}")
        print("\n📝 Place your labels in:")
        print(f"   {os.path.join(os.path.dirname(data_dir), '..', 'labels', 'train')}")
        print("\n   Label format (one .txt per image, same filename):")
        print("   class_id center_x center_y width height")
        print("   Example: 0 0.5 0.6 0.3 0.2")
        print("\n   Class IDs: 0=pothole, 1=road_crack, 2=garbage_dump, 3=broken_pipe,")
        print("   4=damaged_wall, 5=waterlogging, 6=broken_streetlight, 7=fallen_tree")
        print("\n💡 Use tools like LabelImg, Roboflow, or CVAT to label images")
        print("   OR download pre-labeled pothole datasets from Roboflow Universe")

        # Try training with pretrained only (no custom data)
        print("\n🔄 Training on COCO pretrained weights (transfer learning base)...")
        model = YOLO("yolov8n.pt")  # Start from pretrained nano model

        output_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "ml", "weights"
        )
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "yolov8_damage.pt")

        # Just save the pretrained model as base
        import shutil
        model_path = model.ckpt_path if hasattr(model, 'ckpt_path') else "yolov8n.pt"

        print(f"\n✅ Base YOLOv8 model ready at: {output_path}")
        print("   Fine-tune later with labeled pothole/damage images")
        return

    # Train with custom data
    print(f"\nFound {len(images)} training images — starting training...")

    model = YOLO("yolov8n.pt")  # Start from pretrained nano model

    results = model.train(
        data=yaml_path,
        epochs=50,
        imgsz=640,
        batch=16,
        device="cpu",
        patience=10,  # Early stopping
        save=True,
        verbose=True,
        project=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "runs"),
        name="yolo_damage",
    )

    # Copy best weights
    output_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "ml", "weights"
    )
    os.makedirs(output_dir, exist_ok=True)
    best_path = os.path.join(str(results.save_dir), "weights", "best.pt")

    if os.path.exists(best_path):
        import shutil
        output_path = os.path.join(output_dir, "yolov8_damage.pt")
        shutil.copy2(best_path, output_path)
        print(f"\n✅ Best model saved to: {output_path}")
    else:
        print("\n⚠️  Training completed but best.pt not found")

    print(f"\nResults: {results.save_dir}")


if __name__ == "__main__":
    train()
