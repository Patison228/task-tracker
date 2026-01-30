# Stage 1: Build (используется только в production)
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Собираем production сборку
RUN npm run build

# Stage 2: Development и Production сервирование
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Копируем исходный код (для development)
COPY . .

EXPOSE 3000

# Development: запускаем dev server с hot reload
CMD ["npm", "start"]
