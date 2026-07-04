import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const client = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { prepare: false }) : null

export const db = client ? drizzle(client, { schema }) : ({} as any)

export * from "./schema"
