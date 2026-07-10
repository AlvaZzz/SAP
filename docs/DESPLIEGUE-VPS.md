# Desplegar PREXI en un VPS (Oracle Cloud gratis) + DuckDNS + HTTPS

Guía para dejar PREXI corriendo 24/7 y entrar desde el celular sin tu PC.
Resultado final: `https://tuprexi.duckdns.org` accesible desde cualquier lado.

> **Idea general:** un servidor en la nube siempre encendido corre los mismos
> contenedores Docker que ya usas. Caddy le pone HTTPS automático. Tú entras por
> el navegador del celular.

---

## 0. Lo que vas a necesitar (todo gratis)

- Cuenta en **Oracle Cloud** (pide una tarjeta solo para verificar; no cobra en el plan Always Free).
- Cuenta en **DuckDNS** (subdominio gratis, login con Google/GitHub).
- Tu **clave de Gemini** (la que ya tienes).
- El código de PREXI en **GitHub** (te explico cómo subirlo en el paso 5).

---

## 1. Crear el servidor en Oracle Cloud (Always Free)

1. Entra a <https://www.oracle.com/cloud/free/> y crea la cuenta (elige tu país/región más cercana).
2. En la consola: **Menu → Compute → Instances → Create Instance**.
3. Configura:
   - **Name:** `prexi`
   - **Image:** Canonical **Ubuntu 22.04**
   - **Shape:** clic en *Change Shape* → **Ampere (ARM)** → `VM.Standard.A1.Flex`
     → asígnale **4 OCPU y 24 GB RAM** (es gratis en el Always Free).
   - **Networking:** deja la VCN por defecto y marca **Assign a public IPv4 address**.
   - **SSH keys:** elige *Generate a key pair for me* y **descarga la llave privada**
     (la usarás para conectarte). Guárdala bien.
4. **Create**. Anota la **IP pública** que te asignan (algo como `140.238.x.x`).

> Si no hay capacidad ARM en tu región, prueba otra región o repite en unas horas
> (es común en el free tier). Alternativa: shape AMD `VM.Standard.E2.1.Micro`, pero
> 1 GB de RAM es justo; el ARM es mucho mejor.

---

## 2. Abrir los puertos 80 y 443

Por defecto Oracle bloquea casi todo. Hay que abrir HTTP/HTTPS en **dos** lugares:

**a) En la consola de Oracle (Security List):**
- **Networking → Virtual Cloud Networks → tu VCN → Security Lists → Default Security List**.
- **Add Ingress Rules** (crea dos):
  - Source `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **80**
  - Source `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **443**

**b) En el firewall de Ubuntu (lo harás por SSH en el paso 4):** incluido más abajo.

---

## 3. Apuntar tu subdominio DuckDNS a la IP

1. Entra a <https://www.duckdns.org> e inicia sesión.
2. Crea un subdominio, p. ej. `tuprexi` → te queda `tuprexi.duckdns.org`.
3. En el campo **current ip** pon la **IP pública** de tu servidor (paso 1) y pulsa **update ip**.

Verifica desde tu PC (debe responder la IP):
```bash
ping tuprexi.duckdns.org
```

---

## 4. Conectarte al servidor e instalar Docker

Desde tu PC (PowerShell o terminal), con la llave privada que descargaste:
```bash
ssh -i ruta/a/tu-llave.key ubuntu@LA_IP_PUBLICA
```

Ya dentro del servidor, instala Docker y abre el firewall:
```bash
# Docker + Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# Firewall de Ubuntu: permite SSH, HTTP y HTTPS
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
# Cierra sesión y vuelve a entrar para que tome el grupo docker
exit
```
Reconéctate con el mismo `ssh …` y comprueba: `docker ps` (no debe dar error de permisos).

---

## 5. Subir el código de PREXI al servidor

La forma más cómoda es por **GitHub** (privado). En tu PC, dentro de la carpeta del proyecto:
```bash
# (si aún no tienes repo remoto) crea uno PRIVADO en github.com y luego:
git add -A
git commit -m "Listo para desplegar"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/prexi.git
git push -u origin main
```
En el **servidor**:
```bash
git clone https://github.com/TU_USUARIO/prexi.git prexi
cd prexi
```
> Si el repo es privado, GitHub te pedirá usuario y un **token** (Settings →
> Developer settings → Personal access tokens) como contraseña.

---

## 6. Configurar las variables y levantar todo

En el servidor, dentro de `prexi`:
```bash
cp .env.prod.example .env
nano .env    # edita: DOMINIO, JWT_SECRET, DB_PASSWORD, GEMINI_API_KEY
```
- `DOMINIO=tuprexi.duckdns.org`
- `JWT_SECRET=` pega el resultado de `openssl rand -base64 48`
- `GEMINI_API_KEY=` tu clave
Guarda con `Ctrl+O`, Enter, `Ctrl+X`.

Levanta el sistema (la primera vez tarda unos minutos en construir):
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Mira que arranque bien (el api aplica el esquema y siembra datos solo):
```bash
docker compose -f docker-compose.prod.yml logs -f api
# espera a ver "PREXI UPEA escuchando…"  (Ctrl+C para salir del log)
```

Caddy pedirá el certificado HTTPS automáticamente. En 1-2 minutos:
**abre `https://tuprexi.duckdns.org` en tu celular.** 🎉

---

## 7. Crear tu primer administrador

```bash
docker compose -f docker-compose.prod.yml exec api \
  npm run crear-admin -- --nombre "Tu Nombre" --email admin@tucorreo.com --password "UnaClaveSegura123*"
```
Entra con ese usuario y desde **Admin → Usuarios** crea docentes e investigadores.

---

## Mantenimiento

**Actualizar a una versión nueva** (tras hacer `git push` desde tu PC):
```bash
cd prexi
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**Ver el estado / reiniciar:**
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml restart api
```

**Respaldo de la base de datos** (guárdalo periódicamente):
```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U prexi prexi > respaldo_$(date +%F).sql
```

---

## Notas importantes

- **Piston en ARM:** el sandbox que ejecuta el código Python de la *Zona de
  práctica* usa una imagen que podría no tener versión ARM. Si en los logs ves
  que `prexi-piston` no arranca, **coméntalo** en `docker-compose.prod.yml` (bloque
  `piston:`) y vuelve a levantar. Todo lo demás —pretest, ejercicios, postest,
  ALVARO, gamificación, rangos, emblemas— **funciona igual**; solo se desactiva la
  ejecución de código libre.
- **HTTPS:** el login usa cookie segura, por eso necesitas el dominio DuckDNS con
  HTTPS (ya incluido con Caddy). Por IP pelada sin HTTPS el login no funcionaría.
- **Seguridad mínima:** cambia `JWT_SECRET` y `DB_PASSWORD` por valores propios; no
  reutilices los de ejemplo.
- **Costo:** el shape ARM Always Free de Oracle no tiene costo mensual. Vigila no
  exceder los recursos "always free" al crear más instancias.
