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

export default prisma;