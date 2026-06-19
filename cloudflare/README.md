# Guía de Despliegue en Cloudflare (Pages + Tunnel)

Esta guía detalla los pasos para poner en producción y exponer de forma segura tanto el frontend estático como el backend Flask del ERP usando servicios gratuitos de Cloudflare.

---

## 1. Despliegue del Frontend (Cloudflare Pages)

El frontend consiste en archivos estáticos (`html`, `css`, `js`). Los alojaremos directamente en el borde global de Cloudflare.

### Pasos:
1. **Crear Proyecto en Cloudflare**:
   - Ingresa al panel de Cloudflare y navega a **Workers & Pages** > **Pages** > **Create a project** > **Connect to Git** o **Direct Upload**.
   - Si usas Git (recomendado): selecciona el repositorio del proyecto.
   - En la configuración de construcción:
     - **Framework preset**: `None`
     - **Build command**: (Déjalo vacío, no se necesita compilar)
     - **Build output directory**: `static`
   - Haz clic en **Save and Deploy**.

2. **Proxy Inverso del API (`_redirects`)**:
   - Hemos configurado un archivo `static/_redirects` que Cloudflare Pages lee automáticamente.
   - Todas las llamadas relativas a `/api/*` serán mapeadas y redirigidas a la URL externa configurada (por ejemplo, `https://api.tudominio.com/api/...`), resolviendo el problema de CORS automáticamente.
   - **Edita** `static/_redirects` y reemplaza `https://api.tudominio.com` por la URL de tu subdominio asignado al backend en el paso siguiente.

---

## 2. Exposición y Seguridad del Backend (Cloudflare Tunnel)

Para conectar tu servidor o máquina local (donde corre Flask y la base de datos `db.sqlite`) con la red de Cloudflare sin abrir puertos en el router o firewall de tu empresa, usamos **Cloudflare Tunnel**.

### Pasos:
1. **Instalar `cloudflared` en el servidor backend**:
   - En Linux (Debian/Ubuntu):
     ```bash
     curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
     sudo dpkg -i cloudflared.deb
     ```
   - En macOS:
     ```bash
     brew install cloudflare/cloudflare/cloudflared
     ```

2. **Iniciar sesión en tu cuenta de Cloudflare**:
   ```bash
   cloudflared tunnel login
   ```
   *Esto abrirá el navegador para seleccionar el dominio que quieres vincular.*

3. **Crear el Túnel**:
   ```bash
   cloudflared tunnel create erp-backend
   ```
   *Copia el UUID del túnel generado.*

4. **Configurar el Túnel**:
   - Edita el archivo `cloudflare/config.yml` creado en el proyecto.
   - Reemplaza `<TUNNEL_UUID>` con el UUID obtenido.
   - Reemplaza `api.tudominio.com` con el subdominio que prefieras usar.
   - Copia o mueve el archivo de configuración a la ruta del sistema correspondiente (por defecto en `/root/.cloudflared/config.yml` o `~/.cloudflared/config.yml`).

5. **Crear la ruta DNS en Cloudflare**:
   ```bash
   cloudflared tunnel route dns erp-backend api.tudominio.com
   ```
   *Esto creará un registro CNAME en tu DNS de Cloudflare apuntando al túnel automáticamente.*

6. **Ejecutar el Servidor en Producción**:
   - Usa el script provisto para levantar Flask detrás de Gunicorn:
     ```bash
     ./cloudflare/start_production.sh
     ```
   - Mantén corriendo el túnel en segundo plano o instálalo como servicio del sistema:
     ```bash
     sudo cloudflared service install
     sudo systemctl start cloudflared
     ```

---

## 3. Ventajas de esta Arquitectura
- **Cero puertos abiertos**: Nadie puede atacar directamente tu IP pública ni es necesario abrir puertos de firewall.
- **SSL Gratuito**: Todo el tráfico entre Cloudflare Pages, el cliente y el túnel viaja encriptado vía HTTPS.
- **Sin problemas de CORS**: Al ser proxy inverso sobre el mismo dominio de Pages, el navegador confía nativamente en las llamadas API.

---

## 4. Solución de Problemas (Troubleshooting)

### Error: "Asset too large" al desplegar en Cloudflare Pages
Este error ocurre porque Cloudflare Pages tiene un límite estricto de **25 MB por archivo individual**. Si intentas subir un archivo que excede este límite, el despliegue fallará.

#### Causa Común:
* **Directorio de salida incorrecto**: Si dejas el "Build output directory" vacío o como `.` (la raíz) en la configuración del Dashboard de Cloudflare, la plataforma intentará subir todo el repositorio. Esto incluye el historial de Git (carpeta `.git/` que suele tener packfiles grandes), la base de datos `db.sqlite` local o el entorno virtual `venv/`.

#### Solución:
1. **En la Consola Web de Cloudflare Pages**:
   - Ve a tu proyecto de Pages > **Settings** > **Builds & deploys** > **Build settings**.
   - Asegúrate de que el **Build output directory** (Publish directory) esté configurado como **`static`** (y no como la raíz `.` ni vacío).
2. **Exclusiones Locales**:
   - Hemos creado un archivo `.assetsignore` en la raíz del proyecto para evitar que Wrangler suba carpetas de backend (`venv/`, `database/`, `server/`) en caso de hacer despliegues manuales por línea de comandos.
3. **Seguridad**:
   - Nunca publiques la raíz de tu proyecto en Cloudflare Pages. Hacerlo expone públicamente tu código de Python y tu base de datos SQLite con todos tus registros e información de la empresa. Publicar únicamente la carpeta `static/` mantiene la base de datos totalmente segura.
