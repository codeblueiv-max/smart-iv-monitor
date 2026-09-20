# Smart IV Infusion Monitor - ML Backend Microservice

This microservice houses the machine learning classification and regression pipeline for the Smart IV Monitoring System.

## Architecture

```
ESP32 (Hardware Sensors)
  └─► Firebase Realtime Database (`patients/{patientId}/input`)
        └─► ML Service (FastAPI + scikit-learn)
              ├─► iv_classifier.pkl (RandomForestClassifier: NORMAL / SLOW / FAST / OCCLUSION / ABNORMAL)
              └─► iv_remaining_time_model.pkl (GradientBoostingRegressor: Remaining Time in Hours)
        └─► Firebase Realtime Database (`patients/{patientId}/AI`)
              └─► Smart IV Monitor Frontend (React Realtime UI)
```

## Features & Input Vector
The ML models operate strictly on IV infusion physical telemetry:
1. `weight` (grams measured by Load Cell)
2. `weight_change` (rate of weight change g/min)
3. `drops_per_min` (dpm detected by IR Optical Drop Sensor)
4. `flow_rate` (mL/min calculated from sensor data)
5. `drop_count` (cumulative drop count)

*Note: Heart rate and SpO2 telemetry are intentionally excluded from IV infusion status classification to prevent false correlation.*

## Firebase Output Format (`patients/{patientId}/AI`)
```json
{
  "condition": "NORMAL",
  "confidence": 0.94,
  "remainingTime": 3.2,
  "timestamp": 1700000000000,
  "modelVersion": "v1"
}
```

## Installation & Running Locally

1. Create a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set your Firebase Realtime Database URL:
   ```bash
   export FIREBASE_DATABASE_URL="https://your-project-id-default-rtdb.firebaseio.com"
   ```

4. Run the ML Service:
   ```bash
   python main.py
   # Or with Uvicorn directly:
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

## Training Models with Custom CSV Sensor Data

To train the models on real experimental sensor datasets:

1. Prepare your CSV file formatted as `training_data.csv` with columns:
   `timestamp,weight,weight_change,drops_per_min,flow_rate,drop_count,condition,remaining_time_hours`

2. Run the training script:
   ```bash
   python train_model.py path/to/your/dataset.csv
   ```
   This generates `iv_classifier.pkl` and `iv_remaining_time_model.pkl`.

3. Restart or trigger model reload via API:
   ```bash
   curl -X POST http://localhost:8000/train
   ```

## API Endpoints

- `GET /`: Service health check & model loaded status
- `POST /predict`: Submit raw feature payload for instant ML prediction
- `POST /process-patient/{patient_id}`: Trigger ML evaluation for a specific patient ID on Firebase
- `POST /log-sample`: Append experimental dataset observation to CSV file
- `POST /train`: Trigger background model re-training on CSV dataset

## Safety Notice
This ML layer is designed as an experimental engineering decision-support prototype and is not clinically validated for diagnostic use.
