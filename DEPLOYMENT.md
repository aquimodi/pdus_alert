# Energy Monitoring System - Documentacion Completa de Despliegue y Arquitectura

---

## 1. Vision General del Sistema

Sistema de monitoreo en tiempo real de racks y PDUs (Power Distribution Units) en centros de datos. Permite visualizar metricas de energia (amperaje, voltaje, temperatura, humedad), gestionar alertas criticas, enviar notificaciones a SONAR, y administrar mantenimientos.

### 1.1 Stack Tecnologico

| Capa | Tecnologia | Version Minima |
|------|-----------|----------------|
| Frontend | React + TypeScript + Tailwind CSS | React 18 |
| Bundler | Vite | 7.x |
| Backend | Node.js + Express | Node 16+ |
| Base de datos | SQL Server (MSSQL) | 2017+ |
| Reverse Proxy | Nginx (Windows) | 1.24+ |
| Process Manager | PM2 (opcional) | 5.x |

### 1.2 Diagrama de Arquitectura

```
                    Puerto 80 (HTTP)
                         |
                    +----v-----+
                    |  NGINX   |  (Reverse Proxy + Static Files)
                    |  Windows |
                    +----+-----+
                         |
           +-------------+-------------+
           |                           |
    Archivos estaticos           /api/*
    (dist/ - React SPA)              |
                              +------v------+
                              |   Express   |  Puerto 3001
                              |   Node.js   |
                              +------+------+
                                     |
                    +----------------+----------------+
                    |                |                |
             +------v------+  +-----v-----+  +------v------+
             |  SQL Server |  |  API NENG  |  |  API SONAR  |
             |  Puerto 1433|  |  (Externa) |  |  (Externa)  |
             +-------------+  +-----------+  +-------------+
```

### 1.3 Flujo de Datos

1. **NENG API** proporciona datos en tiempo real de racks (amperaje, voltaje, temperatura)
2. **NENG Sensors API** proporciona datos de sensores ambientales (temperatura, humedad)
3. El backend fusiona ambos origenes y aplica umbrales para clasificar alertas
4. Las alertas criticas se envian automaticamente a **SONAR** (si esta configurado y habilitado)
5. **SQL Server** almacena umbrales, alertas activas, historial, mantenimientos y usuarios

---

## 2. Estructura del Proyecto

```
energy-monitoring-system/
|-- server.cjs                     # Backend Express (API + logica de negocio)
|-- ecosystem.config.cjs           # Configuracion PM2 (gestion de procesos)
|-- nginx.conf                     # Configuracion Nginx (reverse proxy)
|-- .env                           # Variables de entorno (NO subir a git)
|-- .env.example                   # Plantilla de variables de entorno
|-- package.json                   # Dependencias y scripts npm
|-- vite.config.ts                 # Configuracion Vite (bundler)
|-- sql/
|   `-- CompleteDataBase.sql       # Script SQL completo (tablas + datos iniciales)
|-- src/                           # Codigo fuente frontend
|   |-- main.tsx                   # Entry point (React + Router + Auth)
|   |-- App.tsx                    # Componente principal (dashboard)
|   |-- index.css                  # Estilos globales (Tailwind)
|   |-- types/index.ts             # Tipos TypeScript
|   |-- contexts/
|   |   `-- AuthContext.tsx         # Contexto de autenticacion
|   |-- hooks/
|   |   |-- useRackData.ts         # Hook principal de datos de racks
|   |   `-- useThresholds.ts       # Hook de umbrales
|   |-- pages/
|   |   |-- LoginPage.tsx          # Pagina de login
|   |   `-- MaintenancePage.tsx    # Pagina de mantenimiento
|   |-- components/
|   |   |-- CountryGroup.tsx       # Agrupacion por pais
|   |   |-- SiteGroup.tsx          # Agrupacion por sitio
|   |   |-- DcGroup.tsx            # Agrupacion por datacenter/sala
|   |   |-- GatewayGroup.tsx       # Agrupacion por gateway
|   |   |-- RackCard.tsx           # Tarjeta de rack individual
|   |   |-- CombinedRackCard.tsx   # Tarjeta de rack combinada
|   |   |-- ThresholdManager.tsx   # Gestion de umbrales globales
|   |   |-- RackThresholdManager.tsx # Umbrales por rack
|   |   |-- UserManagement.tsx     # Gestion de usuarios
|   |   `-- ImportMaintenanceModal.tsx # Importar mantenimiento Excel
|   `-- utils/
|       |-- apiClient.ts           # Cliente API
|       |-- dataProcessing.ts      # Procesamiento y agrupacion de datos
|       |-- thresholdUtils.ts      # Utilidades de umbrales
|       `-- uiUtils.ts             # Utilidades de UI (colores, estados)
`-- dist/                          # Build de produccion (generado)
```

---

## 3. Base de Datos (SQL Server)

### 3.1 Tablas del Sistema

| Tabla | Descripcion |
|-------|-------------|
| `threshold_configs` | Umbrales globales (temperatura, humedad, amperaje, voltaje) |
| `rack_threshold_overrides` | Umbrales personalizados por rack individual |
| `active_critical_alerts` | Alertas criticas activas en tiempo real |
| `maintenance_entries` | Registros de mantenimiento (racks individuales o chains completas) |
| `maintenance_rack_details` | Detalle de cada rack dentro de un mantenimiento |
| `usersAlertado` | Usuarios del sistema (autenticacion, roles, sitios asignados) |
| `alerts_history` | Historico permanente de alertas |
| `maintenance_history` | Historico permanente de mantenimientos |

### 3.2 Sistema de Roles

| Rol | Permisos |
|-----|----------|
| Administrador | Control total: usuarios, umbrales, mantenimiento, alertas, SONAR |
| Operador | Todo excepto gestion de usuarios |
| Tecnico | Ver alertas, gestionar mantenimiento (solo lectura de umbrales) |
| Observador | Solo lectura |

### 3.3 Credenciales por Defecto

- **Usuario**: `admin`
- **Password**: `Admin123!`

### 3.4 Instalacion de la Base de Datos

```bash
sqlcmd -S localhost -U sa -P <tu_password> -i sql/CompleteDataBase.sql
```

El script es idempotente: usa `IF NOT EXISTS` para todas las tablas y `MERGE` para los datos iniciales.

---

## 4. API Backend - Endpoints

### 4.1 Autenticacion

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/login` | Iniciar sesion | No |
| POST | `/api/auth/logout` | Cerrar sesion | Si |
| GET | `/api/auth/session` | Verificar sesion activa | No |

### 4.2 Datos de Racks

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| GET | `/api/racks/energy` | Datos de energia de todos los racks (fusiona NENG + sensores + alertas) | Si |

### 4.3 Umbrales

| Metodo | Ruta | Descripcion | Auth/Rol |
|--------|------|-------------|----------|
| GET | `/api/thresholds` | Obtener umbrales globales | Si |
| PUT | `/api/thresholds` | Actualizar umbrales globales | Admin/Operador |
| GET | `/api/racks/:rackId/thresholds` | Obtener umbrales de un rack | Si |
| PUT | `/api/racks/:rackId/thresholds` | Actualizar umbrales de un rack | Admin/Operador |
| DELETE | `/api/racks/:rackId/thresholds` | Eliminar umbrales de un rack (vuelve a globales) | Admin/Operador |

### 4.4 Mantenimiento

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| GET | `/api/maintenance` | Listar mantenimientos activos | Si |
| POST | `/api/maintenance/rack` | Enviar rack a mantenimiento | Si |
| POST | `/api/maintenance/chain` | Enviar chain completa a mantenimiento | Si |
| DELETE | `/api/maintenance/rack/:rackId` | Sacar rack de mantenimiento | Si |
| DELETE | `/api/maintenance/entry/:entryId` | Eliminar entrada de mantenimiento completa | Si |
| DELETE | `/api/maintenance/all` | Eliminar todos los mantenimientos | Si |
| GET | `/api/maintenance/template` | Descargar plantilla Excel de mantenimiento | No |
| POST | `/api/maintenance/import-excel` | Importar mantenimiento desde Excel | Si |

### 4.5 Usuarios

| Metodo | Ruta | Descripcion | Auth/Rol |
|--------|------|-------------|----------|
| GET | `/api/users` | Listar usuarios | Admin |
| POST | `/api/users` | Crear usuario | Admin |
| PUT | `/api/users/:id` | Actualizar usuario | Admin |
| DELETE | `/api/users/:id` | Eliminar usuario | Admin |
| GET | `/api/sites` | Listar sitios disponibles | Si |

### 4.6 SONAR y Alertas

| Metodo | Ruta | Descripcion | Auth/Rol |
|--------|------|-------------|----------|
| GET | `/api/sonar/errors` | Ver errores de envio a SONAR | Si |
| GET | `/api/sonar/status` | Estado de la integracion SONAR | Si |
| POST | `/api/sonar/send-individual` | Enviar alerta individual a SONAR | Admin/Operador |
| GET | `/api/alert-sending` | Estado del envio automatico de alertas | Si |
| POST | `/api/alert-sending` | Activar/desactivar envio automatico | Admin/Operador |

### 4.7 Exportacion

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| POST | `/api/export/alerts` | Exportar alertas a Excel | Si |

### 4.8 Sistema

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| GET | `/api/health` | Health check del backend | No |

---

## 5. Variables de Entorno

Copiar `.env.example` a `.env` y configurar:

### 5.1 Obligatorias

```env
# Servidor
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost

# SQL Server
SQL_SERVER_HOST=localhost
SQL_SERVER_DATABASE=energy_monitor_db
SQL_SERVER_USER=sa
SQL_SERVER_PASSWORD=<password_sql>
SQL_SERVER_PORT=1433
SQL_SERVER_ENCRYPT=false

# API NENG (fuente de datos de racks)
NENG_API_URL=https://<tu-api-neng>/v1/energy/racks
NENG_SENSORS_API_URL=https://<tu-api-neng>/v1/energy/sensors
NENG_API_KEY=<tu_api_key>

# Sesion (cambiar en produccion)
SESSION_SECRET=<secreto_aleatorio_largo>
```

### 5.2 Opcionales (SONAR)

```env
# SONAR - Integracion de alertas
SONAR_API_URL=https://<tu-sonar-api>/alerts
SONAR_BEARER_TOKEN=<tu_token>
SONAR_SKIP_SSL_VERIFY=false

# Intervalo de procesamiento automatico de alertas (ms, default: 120000 = 2 min)
ALERT_PROCESSING_INTERVAL_MS=120000
```

### 5.3 Opcionales (Generales)

```env
LOG_LEVEL=info                    # Nivel de log: debug, info, warn, error
API_TIMEOUT=10000                 # Timeout de APIs externas (ms)
BACKEND_POLLING_INTERVAL=30000    # Intervalo de polling del backend (ms)
```

---

## 6. Configuracion de Nginx (Produccion en Windows)

### 6.1 Funcion de Nginx en el Sistema

Nginx actua como:
- **Servidor de archivos estaticos**: Sirve el build de React (`dist/`) directamente
- **Reverse proxy**: Redirige las peticiones `/api/*` al backend Node.js (puerto 3001)
- **Load balancer**: Soporta un servidor backup en puerto 3002 (si se usa PM2 cluster)
- **Compresion**: gzip para reducir ancho de banda
- **Cache**: Cache de assets estaticos (JS, CSS, imagenes) con expiracion de 1 anio
- **Seguridad**: Headers de seguridad (X-Frame-Options, X-Content-Type-Options, etc.)

### 6.2 PROBLEMA CONOCIDO: Nginx se apaga periodicamente

**Causa raiz identificada: Nginx en Windows NO es un servicio nativo.**

A diferencia de Linux, Nginx en Windows se ejecuta como un proceso de consola simple, no como un servicio del sistema. Esto causa los siguientes problemas:

1. **Sin auto-reinicio**: Si el proceso muere por cualquier razon (error, falta de memoria, cierre accidental de la terminal), no hay nada que lo reinicie automaticamente.

2. **`use select;` en lugar de `epoll`**: La directiva `events { use select; }` en el `nginx.conf` es correcta para Windows (Windows no soporta epoll/kqueue), pero el modelo `select` tiene limitaciones de rendimiento y escalabilidad.

3. **Worker processes `auto`**: En Windows, `worker_processes auto` puede generar multiples workers que compiten por el mismo socket, causando inestabilidad. **Debe ser `1` en Windows.**

4. **Directorios temporales inexistentes**: Si los directorios temp no existen al arrancar, Nginx falla silenciosamente o se cierra.

5. **Logs no rotados**: Sin rotacion de logs, los archivos crecen indefinidamente y pueden causar que Nginx se quede sin espacio o se vuelva lento.

6. **Backend caido + proxy_pass**: Si el backend Node.js se cae y no hay `proxy_next_upstream`, Nginx devuelve 502 pero sigue funcionando. Sin embargo, si el upstream completo esta caido durante mucho tiempo, Nginx puede comportarse de forma impredecible en Windows.

### 6.3 Solucion: Nginx como Servicio de Windows

Para que Nginx se mantenga activo permanentemente, se debe registrar como servicio de Windows usando **NSSM** (Non-Sucking Service Manager) o **WinSW**.

#### Opcion A: Usando NSSM (Recomendado)

```powershell
# 1. Descargar NSSM desde https://nssm.cc/download
# 2. Extraer nssm.exe en D:\nginx\ o en una carpeta del PATH

# 3. Instalar Nginx como servicio
nssm install nginx "D:\nginx\nginx.exe"

# 4. Configurar el directorio de trabajo (CRITICO)
nssm set nginx AppDirectory "D:\nginx"

# 5. Configurar reinicio automatico ante fallos
nssm set nginx AppRestartDelay 5000
nssm set nginx AppStopMethodSkip 6
nssm set nginx AppExit Default Restart

# 6. Configurar logs de NSSM
nssm set nginx AppStdout "D:\nginx\logs\nssm-stdout.log"
nssm set nginx AppStderr "D:\nginx\logs\nssm-stderr.log"

# 7. Iniciar el servicio
nssm start nginx
```

#### Opcion B: Usando WinSW

1. Descargar WinSW desde https://github.com/winsw/winsw/releases
2. Renombrar el ejecutable a `nginx-service.exe` y colocarlo en `D:\nginx\`
3. Crear `D:\nginx\nginx-service.xml`:

```xml
<service>
  <id>nginx</id>
  <name>Nginx</name>
  <description>Nginx HTTP Server for Energy Monitoring</description>
  <executable>D:\nginx\nginx.exe</executable>
  <logpath>D:\nginx\logs</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="30 sec"/>
  <startmode>Automatic</startmode>
  <workingdirectory>D:\nginx</workingdirectory>
</service>
```

4. Instalar y arrancar:
```powershell
D:\nginx\nginx-service.exe install
D:\nginx\nginx-service.exe start
```

#### Verificar que el servicio funciona

```powershell
# Comprobar estado del servicio
sc query nginx

# Verificar que Nginx responde
Invoke-WebRequest -Uri http://localhost/health -UseBasicParsing

# Ver logs de errores
Get-Content D:\nginx\logs\error.log -Tail 20
```

### 6.4 Configuracion de Nginx Corregida

A continuacion se muestra la configuracion recomendada con las correcciones necesarias para estabilidad en Windows:

```nginx
# CRITICO: En Windows usar SIEMPRE 1 worker
worker_processes 1;
error_log logs/error.log warn;
pid logs/nginx.pid;

events {
    worker_connections 1024;
    # "select" es el unico metodo estable en Windows (NO cambiar)
    use select;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # Directorios temporales (deben existir ANTES de arrancar)
    client_body_temp_path temp/client_body_temp;
    proxy_temp_path temp/proxy_temp;
    fastcgi_temp_path temp/fastcgi_temp;
    uwsgi_temp_path temp/uwsgi_temp;
    scgi_temp_path temp/scgi_temp;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';

    access_log logs/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json application/xml+rss;

    # Headers de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Upstream del backend Node.js
    upstream energy_api {
        server 127.0.0.1:3001;
        server 127.0.0.1:3002 backup;
        keepalive 32;
    }

    server {
        listen 80;
        server_name localhost energy-monitor.local;
        root D:/nginx/pdus/dist;
        index index.html;

        access_log logs/energy-monitor-access.log main;
        error_log logs/energy-monitor-error.log;
        server_tokens off;

        # SPA - Todas las rutas caen a index.html
        location / {
            try_files $uri $uri/ /index.html;

            # Cache agresivo para assets con hash en el nombre
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 1y;
                add_header Cache-Control "public, no-transform";
            }
        }

        # Proxy al backend Express
        location /api/ {
            proxy_pass http://energy_api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 10s;
            proxy_send_timeout 300s;

            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        error_page 404 /index.html;
        error_page 500 502 503 504 /50x.html;

        location = /50x.html {
            root D:/nginx/html;
        }
    }
}
```

**Cambios criticos respecto a la configuracion original:**

1. `worker_processes 1;` en lugar de `auto` (estabilidad en Windows)
2. Nivel de error_log cambiado a `warn` para mejor diagnostico
3. Se eliminaron comentarios de HTTPS no usados para reducir complejidad

### 6.5 Preparacion del Entorno Nginx

Antes de iniciar Nginx, estos directorios **deben existir**:

```powershell
# Crear todos los directorios necesarios
New-Item -ItemType Directory -Force -Path @(
    "D:\nginx\temp\client_body_temp",
    "D:\nginx\temp\proxy_temp",
    "D:\nginx\temp\fastcgi_temp",
    "D:\nginx\temp\uwsgi_temp",
    "D:\nginx\temp\scgi_temp",
    "D:\nginx\pdus\dist",
    "D:\nginx\logs"
)
```

### 6.6 Estructura de Directorios de Nginx

```
D:\nginx\
|-- nginx.exe
|-- conf\
|   `-- nginx.conf
|-- logs\
|   |-- access.log
|   |-- error.log
|   |-- energy-monitor-access.log
|   `-- energy-monitor-error.log
|-- temp\
|   |-- client_body_temp\
|   |-- proxy_temp\
|   |-- fastcgi_temp\
|   |-- uwsgi_temp\
|   `-- scgi_temp\
|-- pdus\
|   `-- dist\              <-- Aqui va el build de React
|       |-- index.html
|       `-- assets\
|           |-- index-[hash].js
|           |-- index-[hash].css
|           `-- vendor-[hash].js
`-- html\
    `-- 50x.html           <-- Pagina de error por defecto
```

---

## 7. Guia de Despliegue Paso a Paso

### 7.1 Requisitos Previos

- Windows Server 2016+ o Windows 10+
- Node.js >= 16.0.0 y npm >= 8.0.0
- SQL Server 2017+ (con autenticacion SQL activada)
- Nginx para Windows (descargar de https://nginx.org/en/download.html - version estable)
- NSSM (descargar de https://nssm.cc/download) para registrar Nginx como servicio

### 7.2 Paso 1: Instalar la Base de Datos

```bash
# Conectar a SQL Server y ejecutar el script
sqlcmd -S localhost -U sa -P <tu_password> -i sql/CompleteDataBase.sql
```

Verificar la instalacion:
```bash
sqlcmd -S localhost -U sa -P <tu_password> -Q "USE energy_monitor_db; SELECT name FROM sys.tables;"
```

Resultado esperado: 8 tablas listadas.

### 7.3 Paso 2: Configurar Variables de Entorno

```bash
# Copiar plantilla
copy .env.example .env

# Editar .env con los valores reales (ver seccion 5)
```

### 7.4 Paso 3: Instalar Dependencias y Compilar

```bash
npm install
npm run build
```

Esto genera la carpeta `dist/` con los archivos estaticos del frontend.

### 7.5 Paso 4: Configurar Nginx

```powershell
# 1. Crear directorios temporales y de la app
New-Item -ItemType Directory -Force -Path @(
    "D:\nginx\temp\client_body_temp",
    "D:\nginx\temp\proxy_temp",
    "D:\nginx\temp\fastcgi_temp",
    "D:\nginx\temp\uwsgi_temp",
    "D:\nginx\temp\scgi_temp",
    "D:\nginx\pdus\dist"
)

# 2. Copiar configuracion de Nginx
Copy-Item .\nginx.conf D:\nginx\conf\nginx.conf -Force

# 3. Copiar build del frontend
Copy-Item -Recurse -Force .\dist\* D:\nginx\pdus\dist\

# 4. Verificar configuracion
cd D:\nginx
.\nginx.exe -t
# Resultado esperado: "syntax is ok" y "test is successful"
```

### 7.6 Paso 5: Registrar Nginx como Servicio (Resuelve el problema de apagado)

```powershell
# Usando NSSM (ver seccion 6.3 para detalles)
nssm install nginx "D:\nginx\nginx.exe"
nssm set nginx AppDirectory "D:\nginx"
nssm set nginx AppRestartDelay 5000
nssm set nginx AppExit Default Restart
nssm set nginx AppStdout "D:\nginx\logs\nssm-stdout.log"
nssm set nginx AppStderr "D:\nginx\logs\nssm-stderr.log"
nssm start nginx
```

### 7.7 Paso 6: Iniciar el Backend

#### Opcion A: Con PM2 (Recomendado para produccion)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar con configuracion del proyecto
pm2 start ecosystem.config.cjs --env production

# Guardar configuracion para auto-inicio
pm2 save

# Configurar inicio automatico con el sistema
pm2-startup install
```

**Configuracion PM2 (`ecosystem.config.cjs`):**
- 2 instancias en modo cluster
- Reinicio automatico ante fallos (max 10 reintentos)
- Limite de memoria: 500MB por instancia
- Logs en `./logs/pm2-*.log`

#### Opcion B: Ejecucion directa (desarrollo/pruebas)

```bash
npm run server
```

### 7.8 Paso 7: Verificar el Despliegue

```powershell
# 1. Verificar SQL Server
sqlcmd -S localhost -U sa -Q "SELECT @@VERSION"

# 2. Verificar backend
Invoke-WebRequest -Uri http://localhost:3001/api/health -UseBasicParsing

# 3. Verificar Nginx
Invoke-WebRequest -Uri http://localhost/health -UseBasicParsing

# 4. Verificar servicio Nginx
sc query nginx

# 5. Verificar procesos PM2
pm2 status
```

### 7.9 Acceso a la Aplicacion

- **URL**: `http://localhost` (a traves de Nginx)
- **Usuario**: `admin`
- **Password**: `Admin123!`

---

## 8. Operaciones Comunes

### 8.1 Actualizar el Frontend (Nuevo Despliegue)

```powershell
# 1. Compilar
npm run build

# 2. Copiar archivos
Copy-Item -Recurse -Force .\dist\* D:\nginx\pdus\dist\

# 3. Recargar Nginx (sin downtime)
cd D:\nginx
.\nginx.exe -s reload
```

### 8.2 Reiniciar el Backend

```bash
# Con PM2
pm2 restart energy-monitoring-api

# Sin PM2
# Ctrl+C en la terminal y luego:
npm run server
```

### 8.3 Ver Logs

```bash
# Logs del backend (PM2)
pm2 logs energy-monitoring-api

# Logs del backend (archivos)
type .\logs\combined.log
type .\logs\error.log

# Logs de Nginx
type D:\nginx\logs\error.log
type D:\nginx\logs\energy-monitor-error.log
```

### 8.4 Gestionar el Servicio Nginx

```powershell
# Con NSSM
nssm stop nginx
nssm start nginx
nssm restart nginx
nssm status nginx

# Recargar configuracion sin parar el servicio
cd D:\nginx
.\nginx.exe -s reload
```

---

## 9. Solucion de Problemas

### 9.1 Nginx se apaga solo periodicamente

**Causa**: Nginx no esta registrado como servicio de Windows.
**Solucion**: Seguir la seccion 6.3 para registrarlo con NSSM o WinSW.

### 9.2 Nginx no arranca: "CreateDirectory failed"

```
nginx: [emerg] CreateDirectory() "D:\nginx/temp/client_body_temp" failed
```

**Solucion**: Crear los directorios temporales manualmente (ver seccion 6.5).

### 9.3 Puerto 80 ocupado

```
nginx: [emerg] bind() to 0.0.0.0:80 failed (10013)
```

**Solucion**: Identificar y detener el proceso que usa el puerto 80:
```powershell
netstat -anob | findstr :80
# Luego cambiar el puerto en nginx.conf a 8080 si es necesario
```

### 9.4 Error de conexion a SQL Server

- Verificar que el servicio MSSQLSERVER esta activo: `sc query MSSQLSERVER`
- Verificar que el puerto 1433 esta abierto: `netstat -an | findstr 1433`
- Verificar credenciales en `.env`
- Verificar que SQL Server Authentication esta habilitado

### 9.5 Backend no responde en /api/

- Verificar que el proceso Node.js esta activo: `pm2 status` o `tasklist | findstr node`
- Verificar el puerto: `netstat -an | findstr 3001`
- Revisar logs: `pm2 logs` o `type .\logs\error.log`

### 9.6 Frontend no carga datos

- Verificar que el backend esta corriendo en el puerto configurado
- Verificar la variable `FRONTEND_URL` en `.env` para CORS
- Verificar las credenciales de la API NENG en `.env`
- Abrir DevTools del navegador y revisar la consola y la pestana Network

### 9.7 Error de sesion/autenticacion

- Verificar que `SESSION_SECRET` esta configurado en `.env`
- Verificar que la tabla `usersAlertado` existe en la BD
- Limpiar cookies del navegador e intentar de nuevo

---

## 10. Desarrollo Local

### 10.1 Configuracion

```bash
# Instalar dependencias
npm install

# Configurar .env (ver seccion 5)
copy .env.example .env
```

### 10.2 Ejecucion

Requiere dos terminales:

```bash
# Terminal 1 - Frontend (Vite dev server con hot reload)
npm run dev
# Disponible en http://localhost:5173

# Terminal 2 - Backend (Express con auto-reinicio)
npm run server:dev
# Disponible en http://localhost:3001
```

Vite esta configurado con un proxy que redirige `/api/*` a `http://localhost:3001`, por lo que en desarrollo no se necesita Nginx.

### 10.3 Scripts Disponibles

| Script | Descripcion |
|--------|-------------|
| `npm run dev` | Frontend en modo desarrollo (Vite) |
| `npm run build` | Compilar frontend para produccion |
| `npm run preview` | Previsualizar build de produccion |
| `npm run server` | Iniciar backend Express |
| `npm run server:dev` | Backend con nodemon (auto-reinicio) |
| `npm run lint` | Ejecutar ESLint |

---

## 11. Notas de Seguridad

- **Cambiar `SESSION_SECRET`** en produccion a un valor aleatorio largo
- **Cambiar la password del usuario admin** tras el primer login
- Las sesiones duran 1 anio (`maxAge` en la configuracion de sesion)
- Las cookies usan `httpOnly: true` y `sameSite: lax`
- Helmet.js esta configurado para headers de seguridad HTTP
- CORS esta restringido a `FRONTEND_URL` en produccion
- Las passwords se almacenan hasheadas con SHA-256 + salt en SQL Server
