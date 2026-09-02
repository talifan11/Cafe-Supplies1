---
name: Catalog storage and manager auth
description: Durable design constraint for the cafe supply catalog's manager-only product management.
---

Catalog image bytes belong in Replit App Storage; PostgreSQL stores only the serving object path. Presigned upload URLs and catalog mutations require the signed manager session, while uploaded image reads remain public so storefront customers can see them.

**Why:** The storefront needs persistent images without bloating database rows, and a client-only admin flag would let any visitor mutate the catalog.

**How to apply:** Keep manager write endpoints behind the session middleware, use the two-step direct-to-storage upload flow, and save only `/api/storage/objects/...` URLs on products.