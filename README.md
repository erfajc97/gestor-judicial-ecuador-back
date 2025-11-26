# Gestor Judicial - Backend API

Sistema backend para gestión de agendamiento judicial con notificaciones automáticas mediante Telegram.

## 📋 Descripción

API REST desarrollada con NestJS que permite gestionar juicios, participantes y notificaciones. El sistema envía automáticamente notificaciones a través de Telegram cuando se crean o actualizan juicios, con seguimiento de estados (enviado, entregado, leído).

## 🏗️ Arquitectura

El proyecto sigue una arquitectura modular basada en NestJS:

- **Módulos principales:**
  - `juicios` - Gestión de juicios (CRUD, participantes)
  - `participantes` - Gestión de participantes del sistema judicial
  - `notificaciones` - Servicio de notificaciones vía Telegram
  - `telegram` - Integración con Telegram Bot API
  - `auditoria` - Registro de errores y eventos del sistema
  - `prisma` - Módulo de base de datos

- **Estructura de carpetas:**

```
src/
├── app.module.ts          # Módulo raíz
├── main.ts                # Punto de entrada
├── juicios/               # Módulo de juicios
│   ├── dto/              # Data Transfer Objects
│   ├── juicios.controller.ts
│   ├── juicios.service.ts
│   └── juicios.module.ts
├── participantes/         # Módulo de participantes
├── notificaciones/        # Servicio de notificaciones
├── telegram/              # Integración Telegram
├── auditoria/            # Sistema de auditoría
└── prisma/                # Configuración Prisma
```

## 🛠️ Tecnologías y Librerías

### Dependencias principales:

- **@nestjs/common, @nestjs/core** (^11.0.1) - Framework NestJS
- **@nestjs/platform-express** (^11.0.1) - Servidor Express
- **@prisma/client** (6.19.0) - ORM para base de datos
- **axios** (^1.13.2) - Cliente HTTP para Telegram API
- **class-validator, class-transformer** - Validación y transformación de DTOs

### Base de datos:

- **PostgreSQL** - Base de datos relacional
- **Prisma** - ORM y migraciones

## 🚀 Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/gestorjudicial?schema=public"
TELEGRAM_BOT_TOKEN=tu_token_de_telegram
PORT=3001
```

### 2. Instalación

```bash
npm install
```

### 3. Base de Datos

```bash
# Generar cliente Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# O hacer push directo (solo desarrollo)
npm run prisma:push

# Ejecutar seeders (datos de ejemplo)
npm run prisma:seed
```

**Scripts combinados:**

```bash
# Setup completo (generate + migrate + seed)
npm run db:setup

# Resetear base de datos
npm run db:reset
```

## 🤖 Configuración de Telegram

### 1. Crear Bot en Telegram

1. Busca **@BotFather** en Telegram
2. Envía `/newbot` y sigue las instrucciones
3. **Guarda el token** que te proporciona (formato: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Agrega el token a tu archivo `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   ```

### 2. Configurar Webhook

#### Desarrollo Local (con ngrok)

1. **Instala ngrok**: https://ngrok.com/download
2. **Inicia el servidor**:
   ```bash
   npm run start:dev
   ```
3. **Ejecuta ngrok** (en otra terminal):
   ```bash
   ngrok http 3001
   ```
4. **Copia la URL HTTPS** de ngrok (ejemplo: `https://abc123.ngrok.io`)
5. **Configura el webhook**:

   ```bash
   # Opción A: Usando el endpoint del servidor
   curl "http://localhost:3001/telegram/set-webhook?url=https://abc123.ngrok.io/telegram/webhook"

   # Opción B: Directamente con la API de Telegram
   curl "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://abc123.ngrok.io/telegram/webhook"
   ```

⚠️ **Importante**: Cada vez que reinicias ngrok obtienes una URL diferente, debes reconfigurar el webhook.

#### Producción

Si tu servidor está desplegado con HTTPS:

```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.com/telegram/webhook"
```

### 3. Verificar Webhook

```bash
# Opción A: Usando el servidor
curl "http://localhost:3001/telegram/webhook-info"

# Opción B: Directamente con la API
curl "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"
```

Deberías ver:

```json
{
  "ok": true,
  "url": "https://tu-url/telegram/webhook",
  "pending_update_count": 0
}
```

### 4. Probar el Bot

1. Busca tu bot en Telegram (por el username que le diste)
2. Envía `/start` - El bot registrará tu Chat ID automáticamente
3. Selecciona tu tipo de participante (Juez, Abogado, Secretario, Psicólogo, Forense)

**Comandos disponibles:**

- `/start` - Registrarse en el sistema
- `/start TIPO` - Registrarse especificando tipo (ej: `/start JUEZ`)
- `/help` - Mostrar ayuda

## 🚀 Ejecutar el Proyecto

### Desarrollo

```bash
npm run start:dev
```

El servidor correrá en `http://localhost:3001`

### Producción

```bash
# Compilar
npm run build

# Ejecutar
npm run start:prod
```

## 📜 Scripts Disponibles

| Script                          | Descripción                                |
| ------------------------------- | ------------------------------------------ |
| `npm run start:dev`             | Inicia servidor en modo desarrollo (watch) |
| `npm run start:prod`            | Inicia servidor en producción              |
| `npm run build`                 | Compila el proyecto                        |
| `npm run prisma:generate`       | Genera cliente Prisma                      |
| `npm run prisma:migrate`        | Ejecuta migraciones (desarrollo)           |
| `npm run prisma:migrate:deploy` | Ejecuta migraciones (producción)           |
| `npm run prisma:push`           | Push directo a BD (solo desarrollo)        |
| `npm run prisma:seed`           | Ejecuta seeders                            |
| `npm run prisma:reset`          | Resetea base de datos                      |
| `npm run prisma:studio`         | Abre Prisma Studio (GUI)                   |
| `npm run db:setup`              | Setup completo (generate + migrate + seed) |
| `npm run db:reset`              | Reset completo de BD                       |

## 📡 Endpoints API

### Juicios

| Método   | Endpoint                                     | Descripción                                        |
| -------- | -------------------------------------------- | -------------------------------------------------- |
| `GET`    | `/juicios`                                   | Listar todos los juicios (con query `?search=...`) |
| `POST`   | `/juicios`                                   | Crear un juicio                                    |
| `GET`    | `/juicios/:id`                               | Obtener un juicio por ID                           |
| `PATCH`  | `/juicios/:id`                               | Actualizar un juicio                               |
| `DELETE` | `/juicios/:id`                               | Eliminar un juicio                                 |
| `POST`   | `/juicios/:id/participantes`                 | Agregar participante a un juicio                   |
| `DELETE` | `/juicios/:id/participantes/:participanteId` | Remover participante de un juicio                  |

### Participantes

| Método   | Endpoint             | Descripción                                              |
| -------- | -------------------- | -------------------------------------------------------- |
| `GET`    | `/participantes`     | Listar todos los participantes (con query `?search=...`) |
| `POST`   | `/participantes`     | Crear un participante                                    |
| `GET`    | `/participantes/:id` | Obtener un participante por ID                           |
| `PATCH`  | `/participantes/:id` | Actualizar un participante                               |
| `DELETE` | `/participantes/:id` | Eliminar un participante                                 |

### Telegram

| Método | Endpoint                        | Descripción                               |
| ------ | ------------------------------- | ----------------------------------------- |
| `POST` | `/telegram/webhook`             | Webhook para recibir mensajes de Telegram |
| `GET`  | `/telegram/set-webhook?url=...` | Configurar webhook                        |
| `GET`  | `/telegram/webhook-info`        | Obtener información del webhook           |
| `POST` | `/telegram/register`            | Registro manual de usuarios               |

### Auditoría

| Método  | Endpoint                  | Descripción                               |
| ------- | ------------------------- | ----------------------------------------- |
| `GET`   | `/auditoria`              | Listar eventos de auditoría (con filtros) |
| `PATCH` | `/auditoria/:id/resolver` | Marcar evento como resuelto               |

## 🔔 Sistema de Notificaciones

El sistema envía notificaciones automáticamente cuando:

- Se crea un nuevo juicio
- Se actualiza un juicio existente
- Se programan recordatorios (24h y 1h antes)

**Estados de notificación:**

- **ENVIADO** - Notificación enviada a Telegram
- **ENTREGADO** - Confirmado recibido (cambia automáticamente después de 1 minuto)
- **LEIDO** - Usuario confirmó lectura presionando el botón en Telegram

## 🗄️ Base de Datos

### Migraciones

Las migraciones se encuentran en `prisma/migrations/`. Para aplicar cambios:

```bash
# Desarrollo (crea nueva migración)
npm run prisma:migrate

# Producción (aplica migraciones existentes)
npm run prisma:migrate:deploy
```

### Seeders

Los seeders crean datos de ejemplo:

- Participantes (Juez, Abogados, Secretario, Psicólogo, Forense)
- Juicios de ejemplo con participantes asignados

```bash
npm run prisma:seed
```

## 🛡️ Manejo de Errores

El sistema incluye:

- Filtro global de excepciones que captura todos los errores
- Respuestas JSON estructuradas
- Registro de errores en auditoría
- Información de debugging en desarrollo

## 📝 Notas Importantes

- El servidor corre en el puerto **3001** por defecto
- CORS está configurado para permitir requests desde `localhost:3000`, `localhost:5173`, etc.
- **HTTPS requerido** para webhooks de Telegram (excepto en localhost con ngrok)
- Los recordatorios programados (24h y 1h antes) requieren un scheduler (cron job) en producción
- Nunca compartas tu `TELEGRAM_BOT_TOKEN` públicamente

## 🔧 Desarrollo

### Estructura de DTOs

Los DTOs se encuentran en cada módulo (`dto/`) y usan `class-validator` para validación:

- `CreateJuicioDto` - Crear juicio
- `UpdateJuicioDto` - Actualizar juicio
- `AddParticipanteDto` - Agregar participante a juicio
- `CreateParticipanteDto` - Crear participante
- `UpdateParticipanteDto` - Actualizar participante

### Tipos de Participantes

Los tipos válidos son:

- `JUEZ`
- `ABOGADO_DEMANDANTE`
- `ABOGADO_DEFENSOR`
- `SECRETARIO`
- `PSICOLOGO`
- `FORENSE`
