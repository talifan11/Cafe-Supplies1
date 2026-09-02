---
name: OpenAPI integer schemas
description: Compatibility constraint between Orval Zod output and the workspace's installed Zod version.
---

OpenAPI `integer` properties currently make Orval emit `zod.int()`, but the installed Zod runtime is Zod 3 and has no `int()` export.

**Why:** Running API codegen chains into the shared library typecheck, so an otherwise valid spec fails before frontend work can start.

**How to apply:** Until the workspace upgrades its Zod/Orval configuration together, represent integer API fields as `number` in the OpenAPI contract and enforce whole-number constraints in server route validation where needed.