"""
CSV Training Data Collector for Smart IV Monitor ML System
"""

import os
import csv
import time
from typing import Dict, Any

DATASET_CSV_PATH = os.path.join(os.path.dirname(__file__), "training_data.csv")
FIELDNAMES = ["timestamp", "weight", "weight_change", "drops_per_min", "flow_rate", "drop_count", "condition", "remaining_time_hours"]

def append_training_sample(sample_data: Dict[str, Any]) -> bool:
    """
    Appends a new experimental sensor observation row to training_data.csv
    Format:
    timestamp, weight, weight_change, drops_per_min, flow_rate, drop_count, condition, remaining_time_hours
    """
    file_exists = os.path.exists(DATASET_CSV_PATH)
    try:
        with open(DATASET_CSV_PATH, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
            if not file_exists:
                writer.writeheader()
            
            writer.writerow({
                "timestamp": sample_data.get("timestamp", int(time.time() * 1000)),
                "weight": sample_data.get("weight", 0.0),
                "weight_change": sample_data.get("weight_change", 0.0),
                "drops_per_min": sample_data.get("drops_per_min", sample_data.get("dripRate", 0.0)),
                "flow_rate": sample_data.get("flow_rate", sample_data.get("flowRate", 0.0)),
                "drop_count": sample_data.get("drop_count", sample_data.get("dropCount", 0.0)),
                "condition": sample_data.get("condition", "NORMAL"),
                "remaining_time_hours": sample_data.get("remaining_time_hours", 0.0),
            })
        return True
    except Exception as e:
        print(f"Error appending sample to CSV: {e}")
        return False
