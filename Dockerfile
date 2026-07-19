FROM python:3.11-slim-bookworm

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for OpenCV, EasyOCR, and PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python requirements
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download standard English model for EasyOCR so it runs offline instantly
# This prevents downloading on the first query which could fail in air-gapped on-premise setups.
RUN python -c "import easyocr; reader = easyocr.Reader(['en'], gpu=False)"

# Copy application files
COPY ./src /app/src
COPY ./external /app/external

# Create a data directory for document uploads
RUN mkdir -p /app/data/input /app/data/processed

EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
