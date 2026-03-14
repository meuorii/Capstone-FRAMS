# ===========================================
#  FRAMS AI Microservice — Hugging Face Space
#  ArcFace (InsightFace) + Anti-Spoof (ResNet34)
# ===========================================

# ---- Base Image ----
FROM python:3.10-slim

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# ---- System Dependencies ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ---- Set Working Directory ----
WORKDIR /app

# ---- Copy Project Files ----
COPY . /app

# ---- Install Python Dependencies ----
RUN pip install --upgrade pip
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# ---- Environment Variables ----
ENV PORT=7860
EXPOSE 7860

# ---- Run Flask App ----
CMD ["python", "app_ai.py"]
