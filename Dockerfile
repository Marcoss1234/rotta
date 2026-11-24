FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_ROOT_DOMAIN
ENV VITE_ROOT_DOMAIN=${VITE_ROOT_DOMAIN}
RUN npm run build


FROM nginx:1.28-alpine AS frontend

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 8080


FROM python:3.12-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app

COPY --chown=app:app backend/ ./backend/
COPY --from=frontend-build --chown=app:app /app/dist ./frontend-dist

USER app

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn server:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
