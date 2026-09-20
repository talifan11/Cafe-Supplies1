import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const SESSION_COOKIE = "cafe_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required for manager sessions");
}
const sessionKey = sessionSecret;

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(payload: string): string {
  return createHmac("sha256", sessionKey).update(payload).digest("base64url");
}

function createToken(): string {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string; exp?: number };
    return parsed.role === "admin" && typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function getCookie(req: Parameters<RequestHandler>[0]): string | undefined {
  const header = req.headers.cookie;
  const match = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return match?.slice(SESSION_COOKIE.length + 1);
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!isValidToken(getCookie(req))) {
    res.status(401).json({ error: "Manager session required" });
    return;
  }
  next();
};

export function isAdminRequest(req: Parameters<RequestHandler>[0]): boolean {
  return isValidToken(getCookie(req));
}

export function setAdminSession(res: Parameters<RequestHandler>[1]): void {
  // For HTTP connections (non-production or when explicitly disabled), don't use Secure flag
  const isProduction = process.env.NODE_ENV === "production";
  const useSecure = process.env.COOKIE_SECURE === "true" || (isProduction && process.env.COOKIE_SECURE !== "false");
  const secure = useSecure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${createToken()}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

export function clearAdminSession(res: Parameters<RequestHandler>[1]): void {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

export function credentialsMatch(login: string, password: string): boolean {
  return safeEqual(login, "admin") && safeEqual(password, "123456");
}