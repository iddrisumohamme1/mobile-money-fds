FROM python:3.12-slim

WORKDIR /srv

COPY backend/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

# App package lives at backend/app; model at backend/model. The model service
# resolves its path relative to the source file, so layout is preserved as-is.
COPY backend/ /srv/backend/

WORKDIR /srv/backend

ENV FRAUD_MODEL_BLEND_WEIGHT=0.5

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
