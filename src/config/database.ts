import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Verificar conexión
prisma.$connect()
  .then(() => console.log('✅ Base de datos PostgreSQL conectada'))
  .catch((err: unknown) => {
    console.error('❌ Error al conectar base de datos:', err);
  });

// Liberar conexiones al apagar el servidor
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;