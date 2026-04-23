import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "secret";

const app = new Elysia()
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET,
    })
  )
  .get("/", () => ({ message: "API is running" }))
  .use(authRoutes)
  .use(userRoutes)
  .listen(PORT);

console.log(`Server running at http://localhost:${PORT}`);
