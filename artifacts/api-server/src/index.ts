import app from "./app";
import { logger } from "./lib/logger";
import path from "path";
import { fileURLToPath } from "url";
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

// Настройка раздачи статических файлов (фронтенда)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Путь к папке dist нашего CRM приложения
const frontendPath = path.join(__dirname, "../../cafe-supply-crm/dist/public");

app.use(express.static(frontendPath));

// Обработка всех остальных запросов (для React Router)
app.get("*", (req, res) => {
  // Если это не API запрос, отдаем index.html
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