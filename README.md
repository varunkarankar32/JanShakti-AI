<div align="center">

# 🏛️ JanShakti.AI

**AI-Powered Citizen Governance Platform** <br>
*Connecting citizens, data, and leaders — end to end.*

[![Frontend - Vercel](https://img.shields.io/badge/Frontend-Deployed_on_Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](#)
[![Backend - Hugging Face](https://img.shields.io/badge/Backend-Hosted_on_HuggingFace-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)

*Built for India's 833M+ rural citizens across 2.5 lakh+ panchayats.*

</div>

<br>

## 🚀 Key Features

* **🎙️ Multi-Modal Input:** File complaints using Voice, Text, or Photo uploads.
* **🧠 AI Priority Engine:** Automatically calculates complaint urgency using a custom (Urgency × Impact × Recurrence × Sentiment) scoring matrix.
* **📊 NLP Classification:** Auto-categorizes incoming complaints into 7 distinct municipal categories.
* **🎭 Sentiment Analysis:** Employs BERT-based models to track and analyze citizen sentiment over time.
* **👁️ YOLOv8 Vision:** Automated pothole and infrastructure damage detection directly from user-uploaded photos.
* **🗣️ Whisper STT:** Seamless Speech-to-Text conversion supporting 12+ regional Indian languages.
* **📈 Leader's Dashboard:** Real-time KPIs, trend analytics, and ward heatmaps for local authorities.
* **📱 Citizen Portal:** Empowers users to file issues, track resolution statuses in real-time, and rate the service.
* **📑 AI Reports:** Auto-generates comprehensive weekly ward reports for municipal oversight.

---

## 🛠️ System Architecture & Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | Next.js 16, TypeScript, React, Tailwind CSS / Vanilla CSS |
| **Backend** | Python, FastAPI, SQLAlchemy, SQLite |
| **AI / ML** | scikit-learn, Hugging Face Transformers, Ultralytics YOLOv8, OpenAI Whisper |
| **Data Viz** | Recharts, Lucide React (Icons) |
| **Deployment**| Vercel (Frontend), Hugging Face (Backend & Inference) |

---

## ⚡ Quick Start & Local Setup

### 1. Frontend Setup (Next.js)
```bash
# Navigate to the project directory
cd JanShakti-AI

# Install dependencies
npm install

# Start the development server
npm run dev
# → Accessible at http://localhost:3000
```

### 2. Backend Setup (FastAPI)
```bash
# Navigate to the backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Required for Whisper audio decoding (Windows/macOS/Linux)
# Install ffmpeg and ensure it is available in PATH

# Run the FastAPI server
uvicorn main:app --host 127.0.0.1 --port 8010
# → Swagger API Docs accessible at http://127.0.0.1:8010/docs
```

### 3. Pretrained Model Bootstrap (Automatic)
On the first backend run, services automatically download/load pretrained models:

- Sentiment: Hugging Face sentiment model (`distilbert-base-uncased-finetuned-sst-2-english`)
- NLP Classification: Hugging Face zero-shot model (`typeform/distilbert-base-uncased-mnli`) if local `classifier.pkl` is missing
- Speech-to-Text: OpenAI Whisper (`base` by default, falls back to `tiny`)
- Vision: Custom YOLO weights if present, otherwise pretrained `yolov8n.pt`

No manual training is required for inference.

If speech transcription fails (missing ffmpeg or unsupported audio), API now returns an explicit error instead of demo/hardcoded text.
For demo-only behavior, set `ALLOW_SIMULATED_TRANSCRIPTION=true` in [backend/.env](backend/.env).

### 4. Twilio WhatsApp + Voice Setup
Create backend env file at [backend/.env](backend/.env) (already added in this workspace) with:

```env
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Then configure Twilio Sandbox/WhatsApp webhook:

```text
Webhook URL: https://<your-public-url>/api/whatsapp/webhook
Method: POST
```

For local development, expose backend with ngrok or Cloudflare tunnel:

```bash
ngrok http 8010
```

Voice notes and image uploads sent in WhatsApp are auto-processed and filed as complaints.

### 5. Model Training (Optional)
If you want to retrain custom models locally:

```bash
cd backend
python ml/train_classifier.py  # Train text classifier
python ml/train_sentiment.py   # Train sentiment model
python ml/train_yolo.py        # Train YOLOv8 damage detector
```

## 📁 Project Structure

```text
JanShakti-AI/
├── src/                  # Next.js frontend
│   ├── app/              # Pages (landing, dashboard, citizen, analytics, etc.)
│   ├── components/       # Reusable UI (Navbar, Footer, etc.)
│   └── lib/              # Utilities and mock data
├── backend/              # FastAPI backend
│   ├── main.py           # Application entry point
│   ├── routers/          # API endpoints (complaints, nlp, priority, etc.)
│   ├── services/         # AI/ML inference services
│   ├── models/           # Database models and Pydantic schemas
│   └── ml/               # Model training and evaluation scripts
└── README.md
```

## 👨‍💻 The Team

Team !Perfect (IIITA)

- Krishna Mohan
- Varun Karankar
- Aditya Kishore
- Kanishk Jain

## 📜 Acknowledgements & License

Proudly built for the Sankalp Hackathon 2026.
