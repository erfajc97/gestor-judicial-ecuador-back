# Guía Rápida: Probar Webhook de Telegram en Local

## 📋 Resumen

- ✅ **El webhook YA EXISTE** en el código (no necesitas instalarlo)
- ⚙️ Solo necesitas **configurarlo** con Telegram
- 🔄 Debes reconfigurarlo **cada vez que reinicias ngrok** (nueva URL)
- 🚀 En producción, solo reconfigura si cambia la URL del servidor

## 🚀 Pasos para Probar en Local

### 1. Verifica que tienes el token en `.env`

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
```

### 2. Inicia el servidor backend

```bash
cd gestorjudicial
npm run start:dev
```

El servidor debería correr en `http://localhost:3001`

### 3. Inicia ngrok (en otra terminal)

```bash
ngrok http 3001
```

**Copia la URL HTTPS** que te muestra ngrok (ejemplo: `https://abc123.ngrok.io`)

⚠️ **Importante**: Cada vez que reinicias ngrok, obtienes una URL diferente, así que debes reconfigurar el webhook.

### 4. Configura el webhook

Usa una de estas opciones:

**Opción A - Usando tu servidor:**

```
http://localhost:3001/telegram/set-webhook?url=https://TU_URL_NGROK/telegram/webhook
```

**Opción B - Directamente con la API de Telegram:**

```
https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://TU_URL_NGROK/telegram/webhook
```

### 5. Verifica que está configurado

**Opción A - Usando tu servidor:**

```
http://localhost:3001/telegram/webhook-info
```

**Opción B - Directamente con la API de Telegram:**

```
https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo
```

Deberías ver algo como:

```json
{
  "ok": true,
  "url": "https://abc123.ngrok.io/telegram/webhook",
  "pending_update_count": 0
}
```

### 6. Prueba el bot

1. Busca tu bot en Telegram (por el username que le diste)
2. Envía el comando `/start`
3. El bot debería responder y registrar tu Chat ID automáticamente

## 🔄 ¿Cuándo Reconfigurar el Webhook?

### ✅ SÍ necesitas reconfigurar cuando:

- Reinicias ngrok (obtienes una nueva URL)
- Cambias de entorno (local → producción)
- Cambias la URL del servidor en producción

### ❌ NO necesitas reconfigurar cuando:

- Solo subes cambios de código
- La URL del servidor sigue siendo la misma
- Reinicias el servidor (pero ngrok sigue con la misma URL)

## 🐛 Solución de Problemas

### El webhook no recibe mensajes

1. Verifica que ngrok esté corriendo
2. Verifica que el servidor esté corriendo en el puerto 3001
3. Verifica que el webhook esté configurado correctamente
4. Revisa los logs del servidor para ver si llegan los webhooks

### Error al configurar el webhook

- Asegúrate de que la URL tenga HTTPS (ngrok lo proporciona)
- Verifica que el token sea correcto
- Verifica que la URL sea accesible desde internet

## 📝 Notas Importantes

- **HTTPS requerido**: Telegram solo acepta webhooks con HTTPS
- **URL accesible**: La URL debe ser accesible desde internet (ngrok lo hace)
- **Token seguro**: Nunca compartas tu token públicamente
