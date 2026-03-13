# JanShakti.AI 🏛️

**AI-Powered Citizen Governance Platform** — connecting citizens, data, and leaders — end to end.

Built for India's 833M+ rural citizens across 2.5 lakh+ panchayats.

## 🚀 Features

- **Multi-Modal Input** — Voice, text, photo complaint filing
- **AI Priority Engine** — Urgency × Impact × Recurrence × Sentiment scoring
- **NLP Classification** — Auto-categorizes complaints (7 categories)
- **Sentiment Analysis** — BERT-based citizen sentiment tracking
- **YOLOv8 Vision** — Pothole/damage detection from photos
- **Whisper STT** — Speech-to-text in 12+ Indian languages
- **Leader's Dashboard** — Real-time KPIs, trend analytics, ward heatmap
- **Citizen Portal** — File complaints, track status, rate resolution
- **AI Reports** — Auto-generated weekly ward reports

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, React, CSS |
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| AI/ML | scikit-learn, Hugging Face Transformers, Ultralytics YOLOv8, OpenAI Whisper |
| Charts | Recharts |
| Icons | Lucide React |

## ⚡ Quick Start

### Frontend
```bash
cd janshakti-ai
npm install
npm run dev
# → http://localhost:3000
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000/docs (Swagger)
```

### Train Models
```bash
cd backend
python ml/train_classifier.py    # Text classifier
python ml/train_sentiment.py     # Sentiment model
python ml/train_yolo.py          # YOLOv8 damage detector
```

## 📁 Project Structure

```
janshakti-ai/
├── src/                    # Next.js Frontend
│   ├── app/               # Pages (landing, dashboard, citizen, analytics, etc.)
│   ├── components/        # Navbar, Footer
│   └── lib/               # Mock data
├── backend/               # FastAPI Backend
│   ├── main.py            # App entry point
│   ├── routers/           # API endpoints (complaints, nlp, priority, etc.)
│   ├── services/          # AI/ML services
│   ├── models/            # DB models + schemas
│   └── ml/                # Training scripts
└── README.md
```

## 👨‍💻 Team — !PerfectIndian (IIITA)

- Krishna Mohan
- Varun Karankar
- Aditya Kishore
- Kanishk Jain

## 📜 License

Built for Sankalp Hackathon 2026.
