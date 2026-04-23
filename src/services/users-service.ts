import { eq } from "drizzle-orm";
import { db } from "../db";
import { sessions, users } from "../db/schema";

const LOGIN_ERROR = "Email atau password salah";

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
