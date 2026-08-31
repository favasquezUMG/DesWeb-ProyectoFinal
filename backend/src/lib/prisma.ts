import { PrismaClient } from "@prisma/client";

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE, PORT } = process.env

const databaseUrl = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PORT || 5432}/${PGDATABASE}?sslmode=${PGSSLMODE || 'require'}`;

process.env.DATABASE_URL = databaseUrl;

export const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
})