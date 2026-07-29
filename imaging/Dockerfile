# CPU-only imaging service: landmarks, region masks, quality gate, warp.
#
# No GPU, no model weights beyond a 3.6MB landmark file. This is the half of the
# pipeline that has to be exact and free per image; the diffusion half (if it is
# ever added) is a separate service so this one keeps starting in seconds.
FROM python:3.12-slim

# libGL/libglib are what opencv links against even in the headless build.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake the landmark model into the image rather than fetching it on first
# request — otherwise the very first client of a cold container pays for a
# download, and a network blip at that moment looks like "the app is broken".
RUN python -c "from landmarks import _ensure_model; print(_ensure_model())"

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
