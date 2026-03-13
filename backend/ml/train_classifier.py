"""
Training Script: Complaint Text Classifier
Trains a TF-IDF + SGDClassifier for categorizing citizen complaints.

Usage:
    python ml/train_classifier.py

Output:
    ml/weights/classifier.pkl — contains trained model + vectorizer
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load_training_data():
    """Load training data from CSV or generate synthetic data."""
    csv_path = os.path.join(os.path.dirname(__file__), "data", "complaints_train.csv")

    if os.path.exists(csv_path):
        print(f"Loading training data from {csv_path}...")
        df = pd.read_csv(csv_path)
        return df["text"].tolist(), df["category"].tolist()

    print("No CSV found — generating synthetic training data...")
    return generate_synthetic_data()


def generate_synthetic_data():
    """Generate synthetic complaint training data."""

    data = {
        "Water Supply": [
            "Water pipe burst on main road near school",
            "No water supply for 3 days in our area",
            "Drinking water contaminated with brown color",
            "Water tanker not arriving since last week",
            "Borewell not working in sector 5",
            "Leaking pipe flooding the street",
            "Low water pressure in apartments",
            "Water supply timing changed without notice",
            "Sewage water mixing with drinking water",
            "Water meter broken need replacement",
            "Tap water smells bad since yesterday",
            "Underground pipeline leaking near park",
            "Water tank overflow causing flooding",
            "No hot water in community center",
            "Water connection disconnected wrongly",
            "Paani ka pipe toot gaya hai gali mein",
            "Teen din se paani nahi aa raha",
            "Nala overflow ho raha hai ward 7 mein",
            "Pipeline burst near children playground",
            "Water supply irregular in low income area",
        ],
        "Roads & Potholes": [
            "Big pothole on highway near toll plaza",
            "Road completely damaged after monsoon",
            "Speed breaker too high causing accidents",
            "Footpath broken and dangerous for walking",
            "Road cave-in near bus stop",
            "Tar road melting in summer heat",
            "No road dividers on busy intersection",
            "Construction debris left on road",
            "Road not repaired after digging for cable",
            "Potholes causing flat tires daily",
            "Damaged road near hospital ambulance route",
            "Broken speed bumps need repair",
            "Road surface cracked after heavy rain",
            "Uneven road causing accidents at night",
            "Sinkhole forming on main road",
            "Sadak toot gayi hai ward 12 mein",
            "Gaddhe bahut hain school ke paas",
            "Highway pe accident ho raha hai daily",
            "Road not asphalted since 2 years",
            "Muddy road impassable in monsoon",
        ],
        "Drainage": [
            "Drainage blocked causing waterlogging",
            "Sewer line overflow in residential area",
            "Manhole cover missing on main road",
            "Stagnant water breeding mosquitoes",
            "Flood water not draining since 2 days",
            "Open drain near school dangerous",
            "Gutter overflowing in front of shop",
            "Drain cleaning not done this month",
            "Nallah blocked with garbage and plastic",
            "Waterlogging during rains destroys crops",
            "Drain overflow entering house basement",
            "Underground drain pipe cracked",
            "Monsoon drainage system non functional",
            "Open drain cover is safety hazard",
            "Sewage backing up into homes",
            "Nallah mein kachra bhara hua hai",
            "Barish mein paani ghar mein aa jata hai",
            "Nala saaf nahi hua abhi tak",
            "Drainage system completely collapsed",
            "Waterlogging on bus route daily",
        ],
        "Electricity": [
            "Streetlight not working for 2 weeks",
            "Power outage daily for 6 hours",
            "Transformer damaged need replacement",
            "Electric pole leaning dangerously",
            "Loose wiring hanging from pole",
            "Voltage fluctuation damaging appliances",
            "Streetlight opposite school broken",
            "No electricity connection since registration",
            "Power cable fallen on ground",
            "Short circuit in public transformer",
            "Bijli nahi aa rahi 5 ghante se",
            "Street light kharab hai raste pe",
            "Transformer mein aag lag gayi",
            "Electric pole bent after storm",
            "No power backup in hospital area",
            "Frequent power cuts in summer",
            "Underground cable fault in colony",
            "Streetlight timer not working properly",
            "Electricity meter showing wrong reading",
            "Power outage in critical medical area",
        ],
        "Garbage & Sanitation": [
            "Garbage not collected for one week",
            "Open dump site near residential area",
            "Dustbin overflowing with waste",
            "No sweeping happening in our street",
            "Garbage burning causing air pollution",
            "Dead animal on road not removed",
            "Public toilet not cleaned properly",
            "Solid waste dumped in empty plot",
            "Garbage truck not coming to our area",
            "Overflowing community dustbin spreading disease",
            "Kachra uthaya nahi gaya ek hafta se",
            "Safai karmchari nahi aate humare area mein",
            "Garbage dump near drinking water source",
            "Sweeping machine not deployed in ward",
            "Waste segregation not happening properly",
            "Trash littered around food market",
            "Community bin broken needs replacement",
            "Medical waste dumped in regular bin",
            "E-waste dumped in public area",
            "No garbage pickup on Sunday despite request",
        ],
        "Safety & Security": [
            "Stray dogs attacking children in colony",
            "No street lights making area unsafe at night",
            "Illegal construction blocking emergency exit",
            "Crime increasing in our neighborhood",
            "No CCTV cameras at dangerous intersection",
            "Drunk driving accidents happening frequently",
            "Abandoned building used for illegal activities",
            "No police patrol in our area at night",
            "Harassment near women college",
            "Fire safety equipment missing in community hall",
            "Traffic signals not working at intersection",
            "Dangerous animals spotted near village",
            "Broken fence allowing trespassers",
            "Unsafe pedestrian crossing near school",
            "Drug dealing reported in public park",
            "Unregistered vehicles parked on footpath",
            "Chain snatching incidents increasing",
            "Eve teasing near bus stand",
            "No safety barriers near construction site",
            "Water body without safety fencing",
        ],
        "Public Health": [
            "Dengue outbreak in our ward",
            "Primary health center has no medicines",
            "Hospital ward not cleaned properly",
            "Vaccination drive cancelled without notice",
            "Doctor not available at government clinic",
            "Ambulance not responding to emergency calls",
            "Food poisoning from community kitchen",
            "Mosquito fogging not done this season",
            "Stagnant water causing malaria spread",
            "No medical facility within 5 km",
            "Medicine shortage in PHC for 2 weeks",
            "Anganwadi center has no nutrition supply",
            "Contaminated food sold near school",
            "Mental health services not available",
            "TB patients not getting proper treatment",
            "Blood bank always out of stock",
            "Measles cases rising in slum area",
            "No ambulance service for rural patients",
            "Hospital overcrowded with no beds",
            "Expired medicines distributed at clinic",
        ],
    }

    texts = []
    labels = []
    for category, examples in data.items():
        texts.extend(examples)
        labels.extend([category] * len(examples))

    return texts, labels


def train_model():
    """Train and save the complaint classifier."""
    texts, labels = load_training_data()

    print(f"\nTraining Data Statistics:")
    print(f"  Total samples: {len(texts)}")
    print(f"  Categories: {len(set(labels))}")
    for cat in sorted(set(labels)):
        count = labels.count(cat)
        print(f"    {cat}: {count} samples")

    # TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 3),
        stop_words="english",
        sublinear_tf=True,
    )

    X = vectorizer.fit_transform(texts)
    y = np.array(labels)

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # SGD Classifier (fast, good for text)
    model = SGDClassifier(
        loss="modified_huber",  # Gives probability estimates
        max_iter=1000,
        random_state=42,
        class_weight="balanced",
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = (y_pred == y_test).mean()

    print(f"\n{'='*50}")
    print(f"  Model Accuracy: {accuracy:.2%}")
    print(f"{'='*50}\n")
    print("Classification Report:")
    print(classification_report(y_test, y_pred))

    # Cross-validation
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
    print(f"\nCross-validation: {cv_scores.mean():.2%} (±{cv_scores.std():.2%})")

    # Save model
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "weights")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "classifier.pkl")

    bundle = {
        "model": model,
        "vectorizer": vectorizer,
        "categories": sorted(set(labels)),
        "accuracy": accuracy,
    }
    joblib.dump(bundle, output_path)
    print(f"\n✅ Model saved to: {output_path}")
    print(f"   Accuracy: {accuracy:.2%}")
    print(f"   Categories: {len(set(labels))}")

    return model, vectorizer


if __name__ == "__main__":
    train_model()
