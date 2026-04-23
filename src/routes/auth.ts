import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET }))
  .post(
    "/register",
    async ({ body, set }) => {
      const { name, email, password } = body as any;

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        set.status = 409;
        return { message: "Email already registered" };
      }

      const hashedPassword = await Bun.password.hash(password);

      await db.insert(users).values({ name, email, password: hashedPassword });

      return { message: "User registered successfully" };
    }
  )
  .post(
    "/login",
    async ({ body, set, jwt }) => {
      const { email, password } = body as any;

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (result.length === 0) {
        set.status = 401;
        return { message: "Invalid credentials" };
      }

      const user = result[0];
      const isValid = await Bun.password.verify(password, user.password);

      if (!isValid) {
        set.status = 401;
        return { message: "Invalid credentials" };
      }

      const token = await jwt.sign({ id: user.id, email: user.email });

      return {
        token,
        user: { id: user.id, name: user.name, email: user.email },
      };
    }
  );
