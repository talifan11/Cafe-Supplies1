# Инструкция по развёртыванию на VPS

## 1. Подготовка переменных окружения

Создайте файл `.env` в папке `artifacts/api-server/`:

```bash
cd artifacts/api-server
cp .env.example .env
nano .env
```

### Обязательные настройки в `.env`:

```env
# Секретный ключ для сессий (обязательно измените!)
SESSION_SECRET=ваш-случайный-ключ-здесь

# Режим работы
NODE_ENV=production

# Безопасность кук (false для HTTP, true для HTTPS)
COOKIE_SECURE=false

# Разрешённые домены (добавьте ваш IP и домен)
ALLOWED_ORIGINS=http://62.217.178.72:5000,http://localhost:5173

# Google Cloud Storage
GCS_PROJECT_ID=ваш-project-id
GCS_BUCKET_NAME=ваш-bucket-name
GCS_KEYFILE_PATH=./gcs-key.json

# База данных
DATABASE_URL=file:./dev.db

# Порт сервера
PORT=3000
```

### Генерация SESSION_SECRET:

```bash
openssl rand -base64 32
```

## 2. Настройка Google Cloud Storage

1. Создайте сервисный аккаунт в Google Cloud Console
2. Скачайте JSON-ключ и сохраните как `gcs-key.json` в папке `artifacts/api-server/`
3. Дайте права на запись в bucket

## 3. Установка зависимостей

```bash
pnpm install
pnpm run build
```

## 4. Запуск через PM2

```bash
# Установка PM2
npm install -g pm2

# Запуск сервера
cd artifacts/api-server
pm2 start dist/index.mjs --name api-server

# Сохранение конфигурации
pm2 save
pm2 startup
```

## 5. Проверка работы

1. Откройте браузер и перейдите на `http://62.217.178.72:5000/admin`
2. Войдите с логином `admin` и паролем `123456`
3. Попробуйте добавить товар с фотографией

## 6. Логи

```bash
# Просмотр логов
pm2 logs api-server

# Перезапуск
pm2 restart api-server
```

## Решение проблем

### Ошибка "Manager session required":
- Проверьте `SESSION_SECRET` в `.env`
- Убедитесь, что `COOKIE_SECURE=false` для HTTP
- Проверьте `ALLOWED_ORIGINS` содержит ваш домен/IP

### Ошибка загрузки фото:
- Проверьте права на `gcs-key.json`
- Убедитесь, что bucket существует и доступен
- Проверьте логи PM2

### CORS ошибки:
- Добавьте ваш домен в `ALLOWED_ORIGINS`
- Перезапустите сервер после изменений
