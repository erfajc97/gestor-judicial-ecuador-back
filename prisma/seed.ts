import { PrismaClient } from '../generated/prisma/client.js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar variables de entorno desde .env
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seeders...');

  // Crear participantes de ejemplo
  const juez = await prisma.participante.upsert({
    where: { id: 'juez-1' },
    update: {},
    create: {
      id: 'juez-1',
      nombre: 'Dr. Juan Pérez',
      email: 'juan.perez@judicatura.gob.ec',
      telefono: '+593 99 123 4567',
      tipo: 'JUEZ',
      telegramChatId: null, // Se actualizará cuando el usuario se registre
    },
  });

  const abogadoDemandante = await prisma.participante.upsert({
    where: { id: 'abogado-1' },
    update: {},
    create: {
      id: 'abogado-1',
      nombre: 'Lic. María García',
      email: 'maria.garcia@abogados.ec',
      telefono: '+593 99 234 5678',
      tipo: 'ABOGADO_DEMANDANTE',
      telegramChatId: null,
    },
  });

  const abogadoDefensor = await prisma.participante.upsert({
    where: { id: 'abogado-2' },
    update: {},
    create: {
      id: 'abogado-2',
      nombre: 'Lic. Carlos Rodríguez',
      email: 'carlos.rodriguez@defensoria.ec',
      telefono: '+593 99 345 6789',
      tipo: 'ABOGADO_DEFENSOR',
      telegramChatId: null,
    },
  });

  const secretario = await prisma.participante.upsert({
    where: { id: 'secretario-1' },
    update: {},
    create: {
      id: 'secretario-1',
      nombre: 'Sr. Pedro López',
      email: 'pedro.lopez@judicatura.gob.ec',
      telefono: '+593 99 456 7890',
      tipo: 'SECRETARIO',
      telegramChatId: null,
    },
  });

  const forense = await prisma.participante.upsert({
    where: { id: 'forense-1' },
    update: {},
    create: {
      id: 'forense-1',
      nombre: 'Ing. Ana Martínez',
      email: 'ana.martinez@forenses.ec',
      telefono: '+593 99 567 8901',
      tipo: 'FORENSE',
      telegramChatId: null,
    },
  });

  const psicologo = await prisma.participante.upsert({
    where: { id: 'psicologo-1' },
    update: {},
    create: {
      id: 'psicologo-1',
      nombre: 'Psic. Luis Ramírez',
      email: 'luis.ramirez@psicologia.ec',
      telefono: '+593 99 678 9012',
      tipo: 'PSICOLOGO',
      telegramChatId: null,
    },
  });

  // Crear más participantes adicionales
  const juez2 = await prisma.participante.upsert({
    where: { id: 'juez-2' },
    update: {},
    create: {
      id: 'juez-2',
      nombre: 'Dra. Laura Fernández',
      email: 'laura.fernandez@judicatura.gob.ec',
      telefono: '+593 99 678 9012',
      tipo: 'JUEZ',
      telegramChatId: null,
    },
  });

  const abogadoDemandante2 = await prisma.participante.upsert({
    where: { id: 'abogado-3' },
    update: {},
    create: {
      id: 'abogado-3',
      nombre: 'Lic. Roberto Sánchez',
      email: 'roberto.sanchez@abogados.ec',
      telefono: '+593 99 789 0123',
      tipo: 'ABOGADO_DEMANDANTE',
      telegramChatId: null,
    },
  });

  const secretario2 = await prisma.participante.upsert({
    where: { id: 'secretario-2' },
    update: {},
    create: {
      id: 'secretario-2',
      nombre: 'Sra. Carmen Torres',
      email: 'carmen.torres@judicatura.gob.ec',
      telefono: '+593 99 890 1234',
      tipo: 'SECRETARIO',
      telegramChatId: null,
    },
  });

  console.log('✅ Participantes creados:', {
    juez: juez.nombre,
    juez2: juez2.nombre,
    abogadoDemandante: abogadoDemandante.nombre,
    abogadoDemandante2: abogadoDemandante2.nombre,
    abogadoDefensor: abogadoDefensor.nombre,
    secretario: secretario.nombre,
    secretario2: secretario2.nombre,
    forense: forense.nombre,
    psicologo: psicologo.nombre,
    total: 9,
  });

  // Crear juicios de ejemplo
  const fechaJuicio1 = new Date();
  fechaJuicio1.setDate(fechaJuicio1.getDate() + 7); // 7 días desde hoy

  const juicio1 = await prisma.juicio.upsert({
    where: { numeroCaso: 'CASE-2024-001' },
    update: {},
    create: {
      numeroCaso: 'CASE-2024-001',
      tipoJuicio: 'Penal',
      fecha: fechaJuicio1,
      hora: '09:00',
      sala: 'Sala 1',
      descripcion: 'Juicio penal de ejemplo para pruebas del sistema',
      estado: 'PROGRAMADO',
      participantes: {
        create: [
          {
            participanteId: juez.id,
            rol: 'Juez Principal',
          },
          {
            participanteId: abogadoDemandante.id,
            rol: 'Abogado de la parte demandante',
          },
          {
            participanteId: abogadoDefensor.id,
            rol: 'Abogado defensor',
          },
          {
            participanteId: secretario.id,
            rol: 'Secretario',
          },
          {
            participanteId: forense.id,
            rol: 'Forense técnico',
          },
          {
            participanteId: psicologo.id,
            rol: 'Psicólogo',
          },
        ],
      },
    },
  });

  const fechaJuicio2 = new Date();
  fechaJuicio2.setDate(fechaJuicio2.getDate() + 14); // 14 días desde hoy

  const juicio2 = await prisma.juicio.upsert({
    where: { numeroCaso: 'CASE-2024-002' },
    update: {},
    create: {
      numeroCaso: 'CASE-2024-002',
      tipoJuicio: 'Civil',
      fecha: fechaJuicio2,
      hora: '14:30',
      sala: 'Sala 2',
      descripcion: 'Juicio civil sobre disputa contractual',
      estado: 'PROGRAMADO',
      participantes: {
        create: [
          {
            participanteId: juez2.id,
            rol: 'Juez Principal',
          },
          {
            participanteId: abogadoDemandante2.id,
            rol: 'Abogado demandante',
          },
          {
            participanteId: abogadoDefensor.id,
            rol: 'Abogado defensor',
          },
          {
            participanteId: secretario2.id,
            rol: 'Secretario',
          },
        ],
      },
    },
  });

  const fechaJuicio3 = new Date();
  fechaJuicio3.setDate(fechaJuicio3.getDate() + 3); // 3 días desde hoy

  const juicio3 = await prisma.juicio.upsert({
    where: { numeroCaso: 'CASE-2024-003' },
    update: {},
    create: {
      numeroCaso: 'CASE-2024-003',
      tipoJuicio: 'Laboral',
      fecha: fechaJuicio3,
      hora: '11:00',
      sala: 'Sala 3',
      descripcion: 'Juicio laboral por despido injustificado',
      estado: 'PROGRAMADO',
      participantes: {
        create: [
          {
            participanteId: juez.id,
            rol: 'Juez Principal',
          },
          {
            participanteId: abogadoDemandante.id,
            rol: 'Abogado del trabajador',
          },
          {
            participanteId: abogadoDefensor.id,
            rol: 'Abogado de la empresa',
          },
        ],
      },
    },
  });

  console.log('✅ Juicios creados:', {
    juicio1: {
      numeroCaso: juicio1.numeroCaso,
      tipo: 'Penal',
      participantes: 6,
    },
    juicio2: {
      numeroCaso: juicio2.numeroCaso,
      tipo: 'Civil',
      participantes: 4,
    },
    juicio3: {
      numeroCaso: juicio3.numeroCaso,
      tipo: 'Laboral',
      participantes: 3,
    },
    total: 3,
  });

  console.log('🎉 Seeders completados exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seeders:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
