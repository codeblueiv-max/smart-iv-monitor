"""
Machine Learning Inference Engine for Smart IV Monitoring System
"""

import os
import joblib
import numpy as np
from typing import Dict, Any, Tuple
from train_model import train_and_save_models, CLASSIFIER_PATH, REGRESSOR_PATH

class IVInfusionMLPipeline:
    def __init__(self):
        self.classifier = None
        self.regressor = None
        self.model_version = "v1"
        self.load_or_train_models()

    def load_or_train_models(self):
        """
        Loads pre-trained scikit-learn models from PKL files.
        If files are missing, automatically triggers training pipeline to build real trained models.
        """
        if not os.path.exists(CLASSIFIER_PATH) or not os.path.exists(REGRESSOR_PATH):
            print("Model files not found. Initiating baseline model training...")
            train_and_save_models()

        try:
            self.classifier = joblib.load(CLASSIFIER_PATH)
            self.regressor = joblib.load(REGRESSOR_PATH)
            print("Successfully loaded trained ML models into memory.")
        except Exception as e:
            print(f"Error loading model files: {e}. Retraining...")
            train_and_save_models()
            self.classifier = joblib.load(CLASSIFIER_PATH)
            self.regressor = joblib.load(REGRESSOR_PATH)

    def extract_features(self, sensor_data: Dict[str, Any]) -> np.ndarray:
        """
        Extracts feature vector from raw sensor telemetries:
        1. weight (grams)
        2. weight_change (weight change rate)
        3. drops_per_min (IR sensor drop rate)
        4. flow_rate (mL/min)
        5. drop_count (cumulative drops)

        Excludes heart rate / SpO2 from classification feature vector.
        """
        weight = float(sensor_data.get("weight", 0.0) or 0.0)
        weight_change = float(sensor_data.get("weight_change", 0.0) or 0.0)
        drops_per_min = float(sensor_data.get("drops_per_min", sensor_data.get("dripRate", 0.0)) or 0.0)
        flow_rate = float(sensor_data.get("flow_rate", sensor_data.get("flowRate", 0.0)) or 0.0)
        drop_count = float(sensor_data.get("drop_count", sensor_data.get("dropCount", 0.0)) or 0.0)

        return np.array([[weight, weight_change, drops_per_min, flow_rate, drop_count]])

    def predict(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs ML classifier & regressor models on input features.
        Returns:
        {
          "condition": str,
          "confidence": float (0.0 - 1.0),
          "remainingTime": float (hours),
          "timestamp": int (ms),
          "modelVersion": str
        }
        """
        if self.classifier is None or self.regressor is None:
            self.load_or_train_models()

        features = self.extract_features(sensor_data)

        # Classify infusion status
        predicted_condition = str(self.classifier.predict(features)[0])
        
        # Calculate confidence probability score
        if hasattr(self.classifier, "predict_proba"):
            probs = self.classifier.predict_proba(features)[0]
            confidence = float(np.max(probs))
        else:
            confidence = 0.95

        # Regress remaining infusion time in hours
        predicted_remaining_hours = float(self.regressor.predict(features)[0])
        predicted_remaining_hours = max(0.0, round(predicted_remaining_hours, 2))

        return {
            "condition": predicted_condition,
            "confidence": round(confidence, 2),
            "remainingTime": predicted_remaining_hours,
            "timestamp": int(sensor_data.get("timestamp", sensor_data.get("lastUpdated", 0)) or 0),
            "modelVersion": self.model_version,
        }
