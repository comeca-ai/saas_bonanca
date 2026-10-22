FROM python:3.12-slim

WORKDIR /srv/pesagem
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/srv/pesagem

COPY app ./app
RUN useradd --system --uid 10001 bonanca && mkdir -p /data && chown -R bonanca:bonanca /srv/pesagem /data
USER bonanca

EXPOSE 8080
CMD ["python", "-m", "app.server", "--host", "0.0.0.0", "--port", "8080"]
