import app from "./app";
import { logger } from "./lib/logger";
import cors from "cors";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// --- 1. Настройка CORS (Критично для работы сессий и загрузки фото) ---
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"];

app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (мобильные приложения, curl, некоторые настройки nginx)
    if (!origin) return callback(null, true);
    
    // Проверка на наличие в белом списке, домены .replit.app или ваш IP
    if (
      allowedOrigins.indexOf(origin) !== -1 || 
      origin.endsWith('.replit.app') || 
      origin.includes('62.217.178.72') ||
      origin.includes('localhost')
    ) {
      callback(null, true);
    } else {
      logger.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Обязательно для передачи кук сессии
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// --- 2. Раздача статики и роутинг фронтенда ---
// Определяем путь к собранным файлам фронтенда
// При деплое через Mirage/PNPM путь обычно относительно корня проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к dist папке (предполагается, что сборка лежит в artifacts/cafe-supply-crm/dist/public)
// Если структура другая, поправьте путь ниже. Для универсальности попробуем найти относительно корня.
const frontendPath = path.join(__dirname, "../../cafe-supply-crm/dist/public");

// Проверяем, существует ли папка, чтобы не падать с ошибкой если фронтенд не собран
try {
  const fs = require('fs');
  if (fs.existsSync(frontendPath)) {
    logger.info(`Serving static files from: ${frontendPath}`);
    
    // Раздаем статические файлы (CSS, JS, картинки)
    app.use(express.static(frontendPath));

    // Обрабатываем все остальные запросы для React Router
    // Важно: это должно быть ПОСЛЕ статических файлов и API роутов
    app.get("*", (req, res, next) => {
      // Если запрос начинается с /api, пропускаем его дальше (к контроллерам)
      if (req.path.startsWith("/api")) {
        return next();
      }
      // Иначе отдаем index.html для SPA роутинга
      res.sendFile(path.join(frontendPath, "index.html"));
    });
  } else {
    logger.warn(`Frontend build not found at ${frontendPath}. API only mode.`);
  }
} catch (e) {
  logger.error("Error setting up static file serving", e);
}

// --- 3. Запуск сервера ---
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info(`Server running on port ${port}`);
});