import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Vacía todas las tablas de datos y reinicia los IDs. El esquema y el historial
// de migraciones (_prisma_migrations) se conservan.
async function main() {
    const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tablas.length === 0) return;
    const lista = tablas.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
    console.log(`Tablas vaciadas: ${tablas.length}`);
}

main()
    .catch((error) => {
        console.error('Error al limpiar la base de datos:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
