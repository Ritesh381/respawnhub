# syntax=docker/dockerfile:1

# Build stage: install dependencies into a virtualenv we can copy across.
FROM python:3.12-slim AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /venv
COPY requirements.txt .
RUN /venv/bin/pip install -r requirements.txt && /venv/bin/pip uninstall -y pip

# Runtime stage: just Python, the virtualenv and the app, running as a normal user.
FROM python:3.12-slim
ENV PATH=/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROMETHEUS_DISABLE_CREATED_SERIES=True
RUN pip uninstall -y pip setuptools wheel 2>/dev/null; \
    useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build /venv /venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
USER 10001
EXPOSE 8000
# Apply migrations (safe with several replicas, see alembic/env.py), then serve.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
