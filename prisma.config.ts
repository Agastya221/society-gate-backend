import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

const databaseUrl = env('DATABASE_URL')

function getMigrationDatabaseUrl() {
  if (process.env.DIRECT_DATABASE_URL) {
    return process.env.DIRECT_DATABASE_URL
  }

  // Neon pooled hosts end with "-pooler". Migrations should use the direct
  // host so Prisma advisory locks are held on a stable connection.
  return databaseUrl.replace('-pooler.', '.')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: getMigrationDatabaseUrl(),
  }
})
