# Поставка — магазин расходников для кафе

Web-магазин для заказа расходных материалов HoReCa и лёгкая CRM-панель для обработки заказов менеджером.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cafe-supply-crm/src/App.tsx` — клиентский каталог, корзина, оформление заказа и CRM-панель.
- `artifacts/cafe-supply-crm/src/index.css` — визуальная тема и адаптивная вёрстка.
- `artifacts/api-server/src/routes/catalog.ts` — товары и категории.
- `artifacts/api-server/src/routes/orders.ts` — создание заказов, сводка и статусы.
- `lib/db/src/schema/` — таблицы товаров, заказов и позиций заказа.
- `lib/api-spec/openapi.yaml` — источник API-контракта.

## Architecture decisions

- Заказ создаётся транзакционно: остатки проверяются и уменьшаются вместе с записью заказа и его позиций.
- Цены копируются в позиции заказа при оформлении, чтобы история не менялась после обновления каталога.
- Корзина хранится в браузере и восстанавливается после перезагрузки; каталог и CRM получают данные через сгенерированные API hooks.

## Product

- Клиент видит каталог с поиском и фильтрами по категориям, добавляет товары в корзину, меняет количества и оформляет доставку.
- Менеджер входит в панель `/admin`, видит заказы и сводные показатели, фильтрует заказы и переводит их между статусами.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
