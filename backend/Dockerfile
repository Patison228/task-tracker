# Development и Production общий базовый слой
FROM python:3.11-slim

WORKDIR /app

# Установка зависимостей системы
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения (для production)
COPY . .

# Открываем порт
EXPOSE 5000

# По умолчанию - development режим
CMD ["python", "app.py"]