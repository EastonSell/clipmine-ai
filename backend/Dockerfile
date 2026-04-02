FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/pyproject.toml /app/pyproject.toml
COPY backend/src /app/src

RUN pip install --upgrade pip && pip install .

EXPOSE 8000

CMD ["uvicorn", "clipmine_api.main:app", "--host", "0.0.0.0", "--port", "8000"]

