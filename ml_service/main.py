"""
FastAPI Machine Learning Service for Smart IV Infusion Monitoring System

Listens to Firebase Realtime Database sensor updates:
ESP32 -> Firebase (/patients/{patientId}/input) -> FastAPI ML Backend -> Firebase (/patients/{patientId}/AI) -> Frontend
"""

import os
import time
import asyncio
import requests
from typing import Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model_runner import IVInfusionMLPipeline
from data_collector import append_training_sample
from train_model import train_and_save_models

app = FastAPI(
    title="Smart IV Monitor ML Backend",
    description="Machine Learning service for IV Infusion Status Classification and Remaining Time Regression",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML Engine pipeline
ml_pipeline = IVInfusionMLPipeline()

# In-memory store for previous weights to compute weight_change over time per patient
patient_weight_history: Dict[str, Dict[str, Any]] = {}

FIREBASE_DB_URL = os.getenv("FIREBASE_DATABASE_URL", "https://your-project-default-rtdb.firebaseio.com").rstrip("/")


class DirectPredictionRequest(BaseModel):
    weight: float
    weight_change: Optional[float] = 0.0
    drops_per_min: float
    flow_rate: float
    drop_count: Optional[float] = 0.0
    timestamp: Optional[int] = None


class SampleLogRequest(BaseModel):
    weight: float
    weight_change: Optional[float] = 0.0
    drops_per_min: float
    flow_rate: float
    drop_count: Optional[float] = 0.0
    condition: str
    remaining_time_hours: Optional[float] = 0.0


@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Smart IV Monitor ML Microservice",
        "modelVersion": ml_pipeline.model_version,
        "classifierLoaded": ml_pipeline.classifier is not None,
        "regressorLoaded": ml_pipeline.regressor is not None,
    }


@app.post("/predict")
def predict_direct(payload: DirectPredictionRequest):
    """
    Direct endpoint for testing ML inference on arbitrary sensor parameters.
    Returns predicted condition, confidence score, and remaining time.
    """
    sensor_dict = payload.dict()
    if not sensor_dict.get("timestamp"):
        sensor_dict["timestamp"] = int(time.time() * 1000)

    prediction = ml_pipeline.predict(sensor_dict)
    return prediction


@app.post("/process-patient/{patient_id}")
def process_patient_telemetry(patient_id: str, background_tasks: BackgroundTasks):
    """
    Fetches sensor telemetry for a patient from Firebase RTDB, computes features,
    runs the ML models, and posts prediction back to /patients/{patientId}/AI.
    """
    if not FIREBASE_DB_URL or "your-project" in FIREBASE_DB_URL:
        raise HTTPException(
            status_code=400,
            detail="FIREBASE_DATABASE_URL environment variable is not configured."
        )

    try:
        url = f"{FIREBASE_DB_URL}/patients/{patient_id}.json"
        res = requests.get(url, timeout=5)
        if res.status_code != 200 or not res.json():
            raise HTTPException(status_code=444, detail=f"Patient {patient_id} not found in Firebase.")

        patient_data = res.json()
        input_data = patient_data.get("input", {})
        output_data = patient_data.get("output", {})

        # Calculate weight change over time
        load_cell = input_data.get("loadCell", {})
        current_weight = float(load_cell.get("weight", output_data.get("remainingVolume", 0.0)) or 0.0)
        now_ms = int(time.time() * 1000)

        prev_info = patient_weight_history.get(patient_id, {})
        prev_weight = prev_info.get("weight", current_weight)
        prev_time = prev_info.get("timestamp", now_ms)

        dt_seconds = (now_ms - prev_time) / 1000.0 if now_ms > prev_time else 1.0
        weight_change = (current_weight - prev_weight) / (dt_seconds / 60.0) if dt_seconds > 0 else 0.0

        patient_weight_history[patient_id] = {"weight": current_weight, "timestamp": now_ms}

        drops_per_min = float(output_data.get("dripRate", input_data.get("irSensor", {}).get("dropCount", 0)) or 0)
        flow_rate = float(output_data.get("flowRate", 0.0) or 0)
        drop_count = float(output_data.get("dropCount", input_data.get("irSensor", {}).get("dropCount", 0)) or 0)

        feature_payload = {
            "weight": current_weight,
            "weight_change": weight_change,
            "drops_per_min": drops_per_min,
            "flow_rate": flow_rate,
            "drop_count": drop_count,
            "timestamp": now_ms,
        }

        # Run model inference
        ai_prediction = ml_pipeline.predict(feature_payload)

        # Write prediction back to Firebase /patients/{patient_id}/AI
        ai_url = f"{FIREBASE_DB_URL}/patients/{patient_id}/AI.json"
        write_res = requests.put(ai_url, json=ai_prediction, timeout=5)

        return {
            "patientId": patient_id,
            "firebaseStatus": write_res.status_code,
            "prediction": ai_prediction,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/log-sample")
def log_training_sample(payload: SampleLogRequest):
    """
    Appends experimental observation sample to CSV training dataset.
    """
    success = append_training_sample(payload.dict())
    return {"status": "success" if success else "error"}


@app.post("/train")
def trigger_retrain(background_tasks: BackgroundTasks):
    """
    Triggers model retraining on stored CSV dataset and reloads PKL artifacts into memory.
    """
    def do_retrain():
        train_and_save_models()
        ml_pipeline.load_or_train_models()

    background_tasks.add_task(do_retrain)
    return {"message": "Model retraining initiated in background."}


# Automated Background Listener for continuous Realtime Database processing
async def auto_process_firebase_loop():
    """
    Continuously polls or watches Firebase RTDB every 5 seconds, running ML model on all active patient streams.
    """
    while True:
        try:
            if FIREBASE_DB_URL and "your-project" not in FIREBASE_DB_URL:
                url = f"{FIREBASE_DB_URL}/patients.json"
                res = requests.get(url, timeout=4)
                if res.status_code == 200 and res.json():
                    patients_map = res.json()
                    for pid, pdata in patients_map.items():
                        if isinstance(pdata, dict) and pdata.get("details", {}).get("monitoring") is not False:
                            try:
                                process_patient_telemetry(pid, BackgroundTasks())
                            except Exception:
                                pass
        except Exception as e:
            pass

        await asyncio.sleep(5)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(auto_process_firebase_loop())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
