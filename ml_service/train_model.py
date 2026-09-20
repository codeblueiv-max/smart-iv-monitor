"""
Smart IV Infusion Monitoring System - Machine Learning Model Trainer

This script trains:
1. Supervised Classification Model (RandomForestClassifier) for IV Infusion Status:
   - NORMAL
   - SLOW INFUSION
   - FAST INFUSION
   - FLOW INTERRUPTION
   - ABNORMAL PATTERN
2. Supervised Regression Model (GradientBoostingRegressor) for Remaining Time Estimation (hours).

Feature vector:
[weight, weight_change, drops_per_min, flow_rate, drop_count]

Note: Heart rate and SpO2 are strictly excluded from IV status classification features.
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, mean_absolute_error

# File paths for saved ML models
CLASSIFIER_PATH = os.path.join(os.path.dirname(__file__), "iv_classifier.pkl")
REGRESSOR_PATH = os.path.join(os.path.dirname(__file__), "iv_remaining_time_model.pkl")
DATASET_PATH = os.path.join(os.path.dirname(__file__), "training_data.csv")


def generate_synthetic_training_dataset(num_samples: int = 1500) -> pd.DataFrame:
    """
    Generates realistic, physically-grounded training dataset for IV infusion scenarios
    when user has not yet uploaded a custom experimental CSV dataset.
    """
    np.random.seed(42)
    records = []

    for _ in range(num_samples):
        # Sample initial volume / weight (100g to 1000g)
        weight = np.random.uniform(10.0, 1000.0)
        
        # Determine condition cluster
        condition_choice = np.random.choice(
            ["NORMAL", "SLOW INFUSION", "FAST INFUSION", "FLOW INTERRUPTION", "ABNORMAL PATTERN"],
            p=[0.45, 0.18, 0.15, 0.12, 0.10]
        )

        if condition_choice == "NORMAL":
            drops_per_min = np.random.uniform(18.0, 32.0)
            weight_change = - (drops_per_min / 20.0) * np.random.uniform(0.8, 1.2) # g/min
            flow_rate = drops_per_min / 20.0 # mL/min approx
            drop_count = int(np.random.uniform(50, 5000))
        elif condition_choice == "SLOW INFUSION":
            drops_per_min = np.random.uniform(3.0, 12.0)
            weight_change = - (drops_per_min / 20.0) * np.random.uniform(0.7, 1.1)
            flow_rate = drops_per_min / 20.0
            drop_count = int(np.random.uniform(10, 2000))
        elif condition_choice == "FAST INFUSION":
            drops_per_min = np.random.uniform(45.0, 90.0)
            weight_change = - (drops_per_min / 20.0) * np.random.uniform(0.9, 1.3)
            flow_rate = drops_per_min / 20.0
            drop_count = int(np.random.uniform(100, 8000))
        elif condition_choice == "FLOW INTERRUPTION":
            drops_per_min = np.random.uniform(0.0, 1.5)
            weight_change = np.random.uniform(-0.05, 0.05) # virtually flat
            flow_rate = 0.0
            drop_count = int(np.random.uniform(0, 1000))
        else: # ABNORMAL PATTERN (erratic leaks or tare spikes)
            drops_per_min = np.random.uniform(0.0, 120.0)
            weight_change = np.random.uniform(-15.0, 10.0) # wild fluctuation
            flow_rate = np.abs(weight_change)
            drop_count = int(np.random.uniform(0, 10000))

        # True remaining time calculation in hours
        if flow_rate > 0.01:
            remaining_time_hours = (weight / (flow_rate * 60.0)) + np.random.normal(0, 0.1)
            remaining_time_hours = max(0.0, remaining_time_hours)
        else:
            remaining_time_hours = 0.0

        records.append({
            "timestamp": int(1700000000000 + len(records) * 10000),
            "weight": round(weight, 2),
            "weight_change": round(weight_change, 3),
            "drops_per_min": round(drops_per_min, 1),
            "flow_rate": round(flow_rate, 3),
            "drop_count": drop_count,
            "condition": condition_choice,
            "remaining_time_hours": round(remaining_time_hours, 2),
        })

    df = pd.DataFrame(records)
    return df


def train_and_save_models(csv_file_path: str = None):
    """
    Loads dataset, trains scikit-learn ML models, and saves PKL artifacts.
    """
    if csv_file_path and os.path.exists(csv_file_path):
        print(f"Loading training data from {csv_file_path}...")
        df = pd.read_csv(csv_file_path)
    else:
        print("No custom CSV dataset found. Generating initial synthetic training dataset...")
        df = generate_synthetic_training_dataset(2000)
        df.to_csv(DATASET_PATH, index=False)
        print(f"Saved generated initial dataset to {DATASET_PATH}")

    feature_cols = ["weight", "weight_change", "drops_per_min", "flow_rate", "drop_count"]

    # Fill missing values if any
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = df[col].fillna(0.0)

    X = df[feature_cols]
    y_class = df["condition"]

    if "remaining_time_hours" in df.columns:
        y_reg = df["remaining_time_hours"]
    else:
        # Compute fallback remaining time target
        y_reg = df.apply(lambda r: (r["weight"] / (r["flow_rate"] * 60.0)) if r["flow_rate"] > 0.01 else 0.0, axis=1)

    # Train Classifier
    X_train_c, X_val_c, y_train_c, y_val_c = train_test_split(X, y_class, test_size=0.2, random_state=42)
    classifier = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
    classifier.fit(X_train_c, y_train_c)
    acc = classifier.score(X_val_c, y_val_c)
    print(f"✅ Classification Model Trained! Validation Accuracy: {acc * 100:.2f}%")

    # Train Regressor
    X_train_r, X_val_r, y_train_r, y_val_r = train_test_split(X, y_reg, test_size=0.2, random_state=42)
    regressor = GradientBoostingRegressor(n_estimators=100, max_depth=6, random_state=42)
    regressor.fit(X_train_r, y_train_r)
    mae = mean_absolute_error(y_val_r, regressor.predict(X_val_r))
    print(f"✅ Regression Model Trained! Mean Absolute Error: {mae:.2f} hours")

    # Save artifacts
    joblib.dump(classifier, CLASSIFIER_PATH)
    joblib.dump(regressor, REGRESSOR_PATH)
    print(f"💾 Saved trained models to:\n - {CLASSIFIER_PATH}\n - {REGRESSOR_PATH}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else DATASET_PATH
    train_and_save_models(path)
