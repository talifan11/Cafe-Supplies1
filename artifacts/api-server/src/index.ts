import app from "./app";
import { logger } from "./lib/logger";
import path from "path";
import express from "express";

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

// Абсолютный путь к собранным файлам фронтенда на VPS
const frontendPath = "/var/www/cafe-supplies/artifacts/cafe-supply-crm/dist/public";

// Раздаем статические файлы (CSS, JS, картинки)
app.use(express.static(frontendPath));

// Обрабатываем все остальные запросы для React Router
// В Express 5 используется синтаксис {*path} вместо *
app.get("/{*path}", (req, res) => {
  // Если запрос не начинается с /api, отдаем главную страницу
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(frontendPath, "index.html"));
  }
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});