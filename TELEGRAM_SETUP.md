# Configuración del Webhook de Telegram

## Pasos para configurar el bot de Telegram

### 1. Crear un bot en Telegram

1. Abre Telegram y busca **@BotFather**
2. Envía el comando `/newbot`
3. Sigue las instrucciones para darle un nombre y username a tu bot
4. **Guarda el token** que te proporciona BotFather (algo como: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Configurar el token en el proyecto

Agrega el token a tu archivo `.env`:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
```

### 3. Configurar el webhook

Para que Telegram envíe mensajes a tu servidor, necesitas configurar el webhook. Hay dos opciones:

#### Opción A: Desarrollo local con ngrok (recomendado para pruebas)

1. **Instala ngrok**: https://ngrok.com/download
2. **Inicia tu servidor** en el puerto 3001
3. **Ejecuta ngrok**:
   ```bash
   ngrok http 3001
   ```
4. **Copia la URL HTTPS** que te da ngrok (ejemplo: `https://abc123.ngrok.io`)
5. **Configura el webhook** usando el endpoint:
   ```
   http://localhost:3001/telegram/set-webhook?url=https://abc123.ngrok.io/telegram/webhook
   ```
   O directamente desde el navegador:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://abc123.ngrok.io/telegram/webhook
   ```

#### Opción B: Servidor en producción

Si tu servidor está desplegado en internet (con HTTPS):

1. **Configura el webhook** usando el endpoint:
   ```
   http://localhost:3001/telegram/set-webhook?url=https://tu-dominio.com/telegram/webhook
   ```
   O directamente:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.com/telegram/webhook
   ```

### 4. Verificar que el webhook está configurado

Puedes verificar el estado del webhook con:

```
https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo
```

### 5. Probar el bot

1. Busca tu bot en Telegram (por el username que le diste)
2. Envía el comando `/start`
3. El bot debería responder y registrar tu Chat ID automáticamente

## Comandos del bot

- `/start` - Registra tu Chat ID en el sistema
- `/help` - Muestra la ayuda

## Notas importantes

- **HTTPS requerido**: Telegram solo acepta webhooks con HTTPS (excepto en localhost con ngrok)
- **Token seguro**: Nunca compartas tu token públicamente
- **URL del webhook**: Debe ser accesible desde internet para que Telegram pueda enviar mensajes
