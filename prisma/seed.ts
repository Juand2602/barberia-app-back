import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');
  console.log('⚠️  NOTA: Este seed crea datos de ejemplo. Tus datos reales vendrán de tu SQLite actual.');

  // ==================== CONFIGURACIÓN ====================
  console.log('⚙️ Creando configuración...');
  
  await prisma.configuracion.upsert({
    where: { clave: 'barberia_nombre' },
    update: {},
    create: {
      clave: 'barberia_nombre',
      valor: process.env.BARBERIA_NOMBRE || 'Madison MVP Barbería',
      descripcion: 'Nombre de la barbería',
    },
  });

  await prisma.configuracion.upsert({
    where: { clave: 'barberia_direccion' },
    update: {},
    create: {
      clave: 'barberia_direccion',
      valor: process.env.BARBERIA_DIRECCION || 'Calle 123 #45-67, Bucaramanga',
      descripcion: 'Dirección de la barbería',
    },
  });

  await prisma.configuracion.upsert({
    where: { clave: 'barberia_telefono' },
    update: {},
    create: {
      clave: 'barberia_telefono',
      valor: '3001234567',
      descripcion: 'Teléfono de contacto',
    },
  });

  console.log('✅ Configuración creada');

  console.log('🎉 Seed completado!');
  console.log('');
  console.log('📝 IMPORTANTE:');
  console.log('   Este seed solo creó configuración básica.');
  console.log('   Tus servicios, empleados y clientes vendrán de tu base de datos actual.');
  console.log('   Puedes agregarlos manualmente o importarlos desde tu SQLite.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });