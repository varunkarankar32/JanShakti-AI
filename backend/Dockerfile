# Dockerfile for container deployment (HF Spaces / Render)
FROM python:3.10-slim

# Install system dependencies required for OpenCV, Whisper, database, and cryptography
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    python3-dev \
    libpq-dev \
    libssl-dev \
    libffi-dev \
    pkg-config \
    cargo \
    rustc \
    && rm -rf /var/lib/apt/lists/*

# Run from an app working directory
WORKDIR /app

# Copy the application code
COPY . /app

# Install standard Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN if [ -f "backend/requirements.txt" ]; then \
        pip install --no-cache-dir --prefer-binary -r backend/requirements.txt; \
    else \
        pip install --no-cache-dir --prefer-binary -r requirements.txt; \
    fi

# Create necessary directories
RUN if [ -d "backend" ]; then \
        mkdir -p backend/ml/weights backend/uploads; \
    else \
        mkdir -p ml/weights uploads; \
    fi

# Expose default port (platform may override via PORT env var)
EXPOSE 7860

# Run FastAPI using platform PORT when provided.
CMD sh -c "if [ -d 'backend' ]; then cd backend; fi && uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"
