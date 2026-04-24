import { eq } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2/promise";
import { db } from "../db";
import { sessions, users } from "../db/schema";

const LOGIN_ERROR = "Email atau password salah";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export type CurrentUserPayload = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export async function getCurrentUser(token: string): Promise<CurrentUserPayload> {
  const sessionRows = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  if (sessionRows.length === 0) {
    throw new UnauthorizedError();
  }

  const userId = sessionRows[0].userId;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRows.length === 0) {
    throw new UnauthorizedError();
  }

  const u = userRows[0];
  const created = u.createdAt;
  const created_at = created instanceof Date ? created.toISOString() : String(created);

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    created_at,
  };
}

export async function loginUser(email: string, password: string): Promise<string> {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (result.length === 0) {
    throw new Error(LOGIN_ERROR);
  }

  const user = result[0];
  const valid = await Bun.password.verify(password, user.password);
  if (!valid) {
    throw new Error(LOGIN_ERROR);
  }

  const token = crypto.randomUUID();
  await db.insert(sessions).values({ token, userId: user.id });
  return token;
}

export async function registerUser(name: string, email: string, password: string): Promise<void> {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const err = new Error("Email already registered") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const hashedPassword = await Bun.password.hash(password);
  await db.insert(users).values({ name, email, password: hashedPassword });
}

export async function logoutUser(token: string): Promise<void> {
  const result = await db.delete(sessions).where(eq(sessions.token, token));
  const header = (Array.isArray(result) ? result[0] : result) as ResultSetHeader;
  const affected = header.affectedRows ?? 0;
  if (affected === 0) {
    throw new UnauthorizedError();
  }
}
