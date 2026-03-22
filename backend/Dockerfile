# Dockerfile for container deployment (HF Spaces / Render)
FROM python:3.10-slim

# Install system dependencies required for OpenCV, Whisper, etc.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up a new user named "user" with user ID 1000
RUN useradd -m -u 1000 user

# Switch to the "user"
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy the application code
COPY --chown=user . $HOME/app

# Install standard Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r backend/requirements.txt

# Create necessary directories
RUN mkdir -p backend/ml/weights backend/uploads

# Expose default port (platform may override via PORT env var)
EXPOSE 7860

# Run FastAPI using platform PORT when provided.
CMD sh -c "cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"
