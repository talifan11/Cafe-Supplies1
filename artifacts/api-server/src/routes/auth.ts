import { Router, type IRouter } from "express";
import { AdminLoginBody, AdminLoginResponse, GetAdminSessionResponse } from "@workspace/api-zod";
import { clearAdminSession, credentialsMatch, isAdminRequest, requireAdmin, setAdminSession } from "../lib/adminAuth";

const router: IRouter = Router();

router.post("/admin/login", (req, res): void => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success || !credentialsMatch(parsed.data.login, parsed.data.password)) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }
  setAdminSession(res);
  res.json(AdminLoginResponse.parse({ authenticated: true }));
});

router.post("/admin/logout", (_req, res): void => {
  clearAdminSession(res);
  res.sendStatus(204);
});

router.get("/admin/session", requireAdmin, (_req, res): void => {
  res.json(GetAdminSessionResponse.parse({ authenticated: true }));
});

export default router;