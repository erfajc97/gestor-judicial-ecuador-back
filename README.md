# Gestor Judicial - Sistema de Agendamiento

Sistema web para agendar juicios y notificar automáticamente a todos los participantes mediante Telegram.

## 🚀 Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/gestorjudicial?schema=public"
TELEGRAM_BOT_TOKEN=tu_token_de_telegram
PORT=3001
```

### 2. Instalación de Dependencias

```bash
npm install
```

### 3. Base de Datos

```bash
# Generar cliente Prisma
npm run prisma:generate

# Crear tablas (opción A: migraciones)
npm run prisma:migrate

# O crear tablas (opción B: push directo)
npm run prisma:push

# Ejecutar seeders
npm run prisma:seed
```

### 4. Configurar Webhook de Telegram

Una vez que el servidor esté corriendo, configura el webhook:

```bash
# Reemplaza YOUR_DOMAIN con tu dominio público
curl "http://localhost:3001/telegram/set-webhook?url=https://YOUR_DOMAIN/telegram/webhook"
```

**Nota:** Para desarrollo local, puedes usar herramientas como [ngrok](https://ngrok.com/) para exponer tu servidor local:

```bash
# Instalar ngrok
# Luego ejecutar:
ngrok http 3001

# Usar la URL de ngrok para el webhook
curl "http://localhost:3001/telegram/set-webhook?url=https://TU_URL_NGROK/telegram/webhook"
```

### 5. Iniciar el Servidor

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## 📋 Funcionalidades

### Webhook de Telegram

El sistema incluye un webhook que permite registro automático de usuarios:

- **Endpoint:** `POST /telegram/webhook`
- **Comandos disponibles:**
  - `/start` - Registra el usuario en el sistema
  - `/help` - Muestra ayuda

Cuando un usuario envía `/start` al bot:

1. El sistema captura su `chat.id`
2. Crea un participante temporal con ese Chat ID
3. Envía un mensaje de confirmación

### Seeders

Los seeders crean datos de ejemplo:

- 5 participantes (Juez, Abogados, Acusado, Perito)
- 1 juicio de ejemplo con todos los participantes

## 🔧 Scripts Disponibles

- `npm run start:dev` - Inicia el servidor en modo desarrollo
- `npm run build` - Compila el proyecto
- `npm run start:prod` - Inicia el servidor en producción
- `npm run prisma:generate` - Genera el cliente Prisma
- `npm run prisma:migrate` - Ejecuta migraciones
- `npm run prisma:push` - Push directo a la base de datos
- `npm run prisma:seed` - Ejecuta los seeders

## 📡 Endpoints

### Juicios

- `GET /juicios` - Listar todos los juicios
- `POST /juicios` - Crear un juicio
- `GET /juicios/:id` - Obtener un juicio
- `PATCH /juicios/:id` - Actualizar un juicio
- `DELETE /juicios/:id` - Eliminar un juicio
- `POST /juicios/:id/participantes` - Agregar participante
- `DELETE /juicios/:id/participantes/:participanteId` - Remover participante

### Participantes

- `GET /participantes` - Listar todos los participantes
- `POST /participantes` - Crear un participante
- `GET /participantes/:id` - Obtener un participante
- `PATCH /participantes/:id` - Actualizar un participante
- `DELETE /participantes/:id` - Eliminar un participante

### Telegram

- `POST /telegram/webhook` - Webhook para recibir mensajes de Telegram
- `GET /telegram/set-webhook?url=...` - Configurar webhook
- `POST /telegram/register` - Registro manual de usuarios

## 🛠️ Manejo de Errores

El sistema incluye un filtro global de excepciones que:

- Captura todos los errores
- Devuelve respuestas JSON estructuradas
- Registra errores en los logs
- Incluye información de debugging (en desarrollo)

## 📝 Notas

- El servidor corre en el puerto 3001 por defecto
- CORS está configurado para permitir requests desde `localhost:3000`, `localhost:5173`, etc.
- Las notificaciones se envían automáticamente al crear/actualizar juicios
- Los recordatorios (24h y 1h antes) deben ser implementados con un scheduler (cron job)
