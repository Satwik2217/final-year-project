FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1
ENV TOKENIZERS_PARALLELISM=false

EXPOSE 7860
ENV PORT=7860

CMD ["python", "app.py"]
