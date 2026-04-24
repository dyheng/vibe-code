import Elysia, { t, ValidationError } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { sessionTokenAuth } from "../plugins/session-token-auth";
import { getCurrentUser, loginUser, logoutUser, registerUser, UnauthorizedError } from "../services/users-service";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

const publicUserRoutes = new Elysia({ prefix: "/api/users" })
  .onError(({ code, error, set }) => {
    const validationFailed =
      code === "VALIDATION" ||
      error instanceof ValidationError ||
      (error instanceof Error && (error as Error & { code?: string }).code === "VALIDATION");
    if (validationFailed) {
      set.status = 400;
      if (error instanceof ValidationError) {
        return {
          error: "Bad Request",
          errors: error.all.map((e) => ({
            field: e.path,
            message: e.message ?? e.summary ?? "Invalid value",
          })),
        };
      }
      return { error: "Bad Request", message: error instanceof Error ? error.message : "Validation failed" };
    }
  })
  .post("/login", async ({ body, set }) => {
    try {
      const { email, password } = body as { email: string; password: string };
      const token = await loginUser(email, password);
      return { data: token };
    } catch {
      set.status = 401;
      return { error: "Email atau password salah" };
    }
  })
  .post(
    "/register",
    async ({ body, set }) => {
      try {
        await registerUser(body.name, body.email, body.password);
        return { message: "User registered successfully" };
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 409) {
          set.status = 409;
          return { message: err.message };
        }
        console.error("register failed:", e);
        set.status = 500;
        return { error: "Internal Server Error" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        email: t.String({ minLength: 5, maxLength: 255, format: "email" }),
        password: t.String({ minLength: 8, maxLength: 255 }),
      }),
    }
  );

const sessionUserRoutes = new Elysia({ prefix: "/api/users" })
  .use(sessionTokenAuth)
  .get("/current", async ({ sessionToken, set }) => {
    try {
      const data = await getCurrentUser(sessionToken!);
      return { data };
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      console.error("getCurrentUser failed:", e);
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .delete("/logout", async ({ sessionToken, set }) => {
    try {
      await logoutUser(sessionToken!);
      return { data: "ok" };
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      console.error("logout failed:", e);
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });

const protectedUserRoutes = new Elysia({ prefix: "/api/users" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET }))
  .onBeforeHandle(async ({ headers, jwt, set }: { headers: any; jwt: any; set: any }) => {
    const auth = headers["authorization"];
    if (!auth?.startsWith("Bearer ")) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
    const payload = await jwt.verify(auth.slice(7));
    if (!payload) {
      set.status = 401;
      return { message: "Invalid token" };
    }
  })
  .derive(async ({ headers, jwt }: { headers: any; jwt: any }) => {
    const auth = headers["authorization"] ?? "";
    const payload = await jwt.verify(auth.slice(7));
    return { currentUser: payload };
  })
  .get("/", async () => {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users);
  })
  .get(
    "/:id",
    async ({ params, set }) => {
      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, Number(params.id)))
        .limit(1);

      if (result.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }
      return result[0];
    },
    { params: t.Object({ id: t.String() }) }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(params.id)))
        .limit(1);

      if (existing.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      const updateData: Partial<{ name: string; email: string }> = {};
      if (body.name) updateData.name = body.name;
      if (body.email) updateData.email = body.email;

      await db.update(users).set(updateData).where(eq(users.id, Number(params.id)));
      return { message: "User updated successfully" };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        email: t.Optional(t.String({ minLength: 5 })),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(params.id)))
        .limit(1);

      if (existing.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      await db.delete(users).where(eq(users.id, Number(params.id)));
      return { message: "User deleted successfully" };
    },
    { params: t.Object({ id: t.String() }) }
  );

export const userRoutes = new Elysia()
  .use(publicUserRoutes)
  .use(sessionUserRoutes)
  .use(protectedUserRoutes);
