# 💈 Barbería WhatsApp API

Backend para sistema de barbería con integración de WhatsApp Cloud API y PostgreSQL.

## 🚀 Características

- ✅ API REST completa para gestión de barbería
- ✅ ChatBot de WhatsApp integrado
- ✅ Gestión de citas automática
- ✅ PostgreSQL como base de datos
- ✅ Deploy listo para Railway

## 📋 Requisitos

- Node.js 18+
- PostgreSQL (o Railway)
- Cuenta de WhatsApp Cloud API

## 🔧 Instalación

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y completa las variables:

```bash
cp .env.example .env
```

### 3. Configurar Prisma

```bash
# Generar Prisma Client
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Ejecutar seed
npx prisma db seed
```

### 4. Iniciar en desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 📦 Scripts Disponibles

```bash
npm run dev              # Desarrollo con hot-reload
npm run build            # Compilar TypeScript
npm start                # Iniciar en producción
npm run prisma:generate  # Generar Prisma Client
npm run prisma:migrate   # Crear migración
npm run prisma:deploy    # Aplicar migraciones (producción)
npm run prisma:studio    # Abrir Prisma Studio
npm run prisma:seed      # Poblar datos iniciales
```

## 🌐 Endpoints API

### Health Check
- `GET /health` - Estado del servidor

### Webhook WhatsApp
- `GET /webhook` - Verificación de webhook
- `POST /webhook` - Recibir mensajes

### Clientes
- `GET /api/clientes` - Listar clientes
- `GET /api/clientes/:id` - Obtener cliente
- `POST /api/clientes` - Crear cliente
- `PUT /api/clientes/:id` - Actualizar cliente
- `DELETE /api/clientes/:id` - Eliminar cliente

### Empleados
- `GET /api/empleados` - Listar empleados
- `GET /api/empleados/:id` - Obtener empleado
- `POST /api/empleados` - Crear empleado
- `PUT /api/empleados/:id` - Actualizar empleado
- `DELETE /api/empleados/:id` - Eliminar empleado

### Servicios
- `GET /api/servicios` - Listar servicios
- `GET /api/servicios/:id` - Obtener servicio
- `POST /api/servicios` - Crear servicio
- `PUT /api/servicios/:id` - Actualizar servicio
- `DELETE /api/servicios/:id` - Eliminar servicio

### Citas
- `GET /api/citas` - Listar citas
- `GET /api/citas/horarios-disponibles` - Consultar horarios
- `GET /api/citas/:radicado` - Obtener cita por radicado
- `POST /api/citas` - Crear cita
- `PATCH /api/citas/:id/estado` - Cambiar estado

### Transacciones
- `GET /api/transacciones` - Listar transacciones
- `GET /api/transacciones/estadisticas` - Estadísticas
- `GET /api/transacciones/:id` - Obtener transacción
- `POST /api/transacciones` - Crear transacción

### Cierre de Caja
- `GET /api/cierre-caja` - Listar cierres
- `GET /api/cierre-caja/ultimo` - Último cierre
- `POST /api/cierre-caja` - Crear cierre

### Reportes
- `GET /api/reportes/ventas` - Ventas por período
- `GET /api/reportes/servicios-mas-vendidos` - Servicios más vendidos
- `GET /api/reportes/ingresos-empleado` - Ingresos por empleado
- `GET /api/reportes/citas-estado` - Citas por estado

## 🤖 Flujo del ChatBot

1. **Bienvenida** - Menú principal
2. **Ubicación** - Muestra dirección de la barbería
3. **Precios** - Lista de servicios y precios
4. **Agendar cita**:
   - Seleccionar barbero
   - Ingresar nombre completo
   - Elegir fecha (hoy, mañana, pasado mañana)
   - Seleccionar hora disponible
   - Confirmación con código de radicado
5. **Cancelar cita**:
   - Ingresar código de radicado
   - Confirmar cancelación

## 🚀 Deploy en Railway

### 1. Instalar Railway CLI

```bash
npm install -g @railway/cli
```

### 2. Login y crear proyecto

```bash
railway login
railway init
```

### 3. Agregar PostgreSQL

```bash
railway add --plugin postgresql
```

### 4. Configurar variables de entorno

```bash
railway variables set WHATSAPP_TOKEN=tu_token
railway variables set WHATSAPP_PHONE_ID=tu_phone_id
railway variables set WHATSAPP_VERIFY_TOKEN=tu_verify_token
railway variables set BARBERIA_NOMBRE="Tu Barbería"
railway variables set BARBERIA_DIRECCION="Tu dirección"
```

### 5. Deploy

```bash
railway up
```

### 6. Ejecutar migraciones

```bash
railway run npx prisma migrate deploy
railway run npx prisma db seed
```

## 📱 Configurar WhatsApp Cloud API

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Crea una aplicación de tipo "Business"
3. Agrega el producto "WhatsApp"
4. Obtén el `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`
5. Configura el webhook:
   - URL: `https://tu-proyecto.railway.app/webhook`
   - Verify Token: El mismo de tu `.env`
6. Suscríbete al evento `messages`

## 🔒 Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `PORT` | Puerto del servidor | No (default: 3000) |
| `NODE_ENV` | Entorno (development/production) | No |
| `DATABASE_URL` | URL de PostgreSQL | Sí |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación del webhook | Sí |
| `BARBERIA_NOMBRE` | Nombre de la barbería | Sí |
| `BARBERIA_DIRECCION` | Dirección de la barbería | Sí |
| `BARBERIA_HORA_APERTURA` | Hora de apertura (HH:MM) | No (default: 09:00) |
| `BARBERIA_HORA_CIERRE` | Hora de cierre (HH:MM) | No (default: 20:00) |
| `TIMEOUT_CONVERSACION` | Timeout de conversación en ms | No (default: 300000) |

## 📊 Estructura del Proyecto

```
barberia-whatsapp-api/
├── src/
│   ├── app.ts                          # App principal
│   ├── config/
│   │   ├── database.ts                 # Configuración Prisma
│   │   └── whatsapp.ts                 # Config WhatsApp
│   ├── types/
│   │   └── index.ts                    # Tipos TypeScript
│   ├── services/
│   │   ├── whatsapp/
│   │   │   ├── bot.service.ts          # Lógica del bot
│   │   │   ├── messages.service.ts     # Envío de mensajes
│   │   │   ├── templates.ts            # Plantillas de mensajes
│   │   │   └── parser.service.ts       # Parse de mensajes
│   │   ├── clientes.service.ts
│   │   ├── empleados.service.ts
│   │   ├── servicios.service.ts
│   │   ├── citas.service.ts
│   │   ├── transacciones.service.ts
│   │   ├── cierrecaja.service.ts
│   │   └── reportes.service.ts
│   ├── controllers/
│   │   ├── webhook.controller.ts
│   │   ├── clientes.controller.ts
│   │   ├── empleados.controller.ts
│   │   ├── servicios.controller.ts
│   │   ├── citas.controller.ts
│   │   ├── transacciones.controller.ts
│   │   ├── cierrecaja.controller.ts
│   │   └── reportes.controller.ts
│   └── routes/
│       ├── webhook.routes.ts
│       ├── clientes.routes.ts
│       ├── empleados.routes.ts
│       ├── servicios.routes.ts
│       ├── citas.routes.ts
│       ├── transacciones.routes.ts
│       ├── cierrecaja.routes.ts
│       └── reportes.routes.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env
├── .env.example
├── .gitignore
├── tsconfig.json
├── nodemon.json
├── railway.json
├── package.json
└── README.md
```

## 🧪 Testing

### Probar la API localmente

```bash
# Health check
curl http://localhost:3000/health

# Listar servicios
curl http://localhost:3000/api/servicios

# Listar empleados
curl http://localhost:3000/api/empleados
```

### Probar el webhook

```bash
# Verificación GET
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=tu_token&hub.challenge=TEST"

# Debería devolver: TEST
```

## 🐛 Solución de Problemas

### Error: Cannot connect to database

**Solución:**
```bash
# Verificar que DATABASE_URL esté configurada
echo $DATABASE_URL

# Regenerar Prisma Client
npx prisma generate

# Aplicar migraciones
npx prisma migrate deploy
```

### Error: Webhook no recibe mensajes

**Solución:**
1. Verifica que el webhook esté configurado en WhatsApp Cloud API
2. Verifica que `WHATSAPP_VERIFY_TOKEN` coincida
3. Revisa los logs: `railway logs --follow`
4. Prueba manualmente el endpoint POST

### Error: Bot no responde

**Solución:**
1. Verifica que `WHATSAPP_TOKEN` sea válido
2. Revisa que el número esté en la lista de prueba
3. Verifica logs del servidor
4. Prueba enviar mensaje de prueba con curl

## 📝 Logs

### Ver logs en desarrollo

```bash
npm run dev
# Los logs aparecen en consola
```

### Ver logs en Railway

```bash
railway logs --follow
```

## 🔄 Actualizar el proyecto

```bash
# Pull últimos cambios
git pull

# Instalar dependencias
npm install

# Aplicar migraciones
npx prisma migrate deploy

# Reiniciar servidor
npm start
```

## 📚 Recursos

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Railway Documentation](https://docs.railway.app)
- [Express Documentation](https://expressjs.com)

## 🤝 Soporte

Para problemas o preguntas, contacta al desarrollador.

## 📄 Licencia

ISC

---

Desarrollado con ❤️ para Madison MVP BarberíaAPI_URL` | URL de WhatsApp API | Sí |
| `WHATSAPP_TOKEN` | Token de acceso | Sí |
| `WHATSAPP_PHONE_ID` | ID del número de teléfono | Sí |
| `WHATSAPP_