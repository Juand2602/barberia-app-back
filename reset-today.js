// scripts/reset-today.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const inicio = new Date();
  inicio.setHours(0,0,0,0);
  const fin = new Date();
  fin.setHours(23,59,59,999);

  console.log('Inicio reset - rango:', inicio.toISOString(), '->', fin.toISOString());

  // 1) Borrar cierres de hoy
  const deletedCierres = await prisma.cierreCaja.deleteMany({
    where: {
      fecha: { gte: inicio, lte: fin }
    }
  });
  console.log('Cierres eliminados:', deletedCierres);

  // 2) Opcional: volver a poner aperturas de hoy como ABIERTA
  const updatedAperturas = await prisma.aperturaCaja.updateMany({
    where: { fecha: { gte: inicio, lte: fin } },
    data: { estado: 'ABIERTA', updatedAt: new Date() }
  });
  console.log('Aperturas re-abiertas (updateMany):', updatedAperturas);

  // 3) Opcional: borrar aperturas de hoy (descomenta si prefieres borrarlas)
   const deletedAperturas = await prisma.aperturaCaja.deleteMany({
     where: { fecha: { gte: inicio, lte: fin } }
   });
  console.log('Aperturas eliminadas:', deletedAperturas);

  console.log('Reset de hoy completado.');
}

main()
  .catch((e) => {
    console.error('Error en reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
