# La base de datos de PREXI: dónde vive, cómo verla, cómo respaldarla

Documento único de referencia. Si alguna vez te preguntas *"¿dónde está la base
de datos?"* o *"¿cómo la miro?"*, la respuesta está aquí.

---

## 1. Dónde vive

| Entorno | Dónde está | Cómo se accede |
|---|---|---|
| **Desarrollo** | Contenedor `prexi-db` (PostgreSQL 16) de `docker-compose.yml`. Los datos viven en el volumen Docker **`sap_pgdata`**, no en una carpeta del proyecto | `localhost:5433`, usuario `prexi`, clave `prexi` |
| **Producción** | Proyecto de **Neon** (PostgreSQL gestionado, capa gratuita) | Solo por las cadenas de conexión de Neon, sobre TLS |

Neon entrega **dos** cadenas de conexión y no son intercambiables:

- **Pooled** (el host lleva `-pooler`) → variable `DATABASE_URL`. La usa la aplicación.
- **Directa** (sin `-pooler`) → variable `DIRECT_URL`. La usan las migraciones, el
  seed y `pg_dump`, que necesitan una conexión real sin pooler.

Ambas deben terminar en `?sslmode=require`. Están declaradas en el bloque
`datasource db` de [`schema.prisma`](../backend/prisma/schema.prisma).

---

## 2. Cómo VER los datos

**Prisma Studio** ya viene incluido: es una interfaz web, no hay que instalar ni
pagar nada. Abre las 36 tablas en el navegador y permite editarlas.

### Contra la base local

```bash
cd backend && npx prisma studio
```

Se abre en `http://localhost:5555`.

### Contra Neon (producción)

No hace falta ningún túnel: Neon es accesible por TLS desde tu PC, y el puerto
nunca queda expuesto en un servidor tuyo porque no hay servidor tuyo.

```bash
cd backend && DATABASE_URL='LA_CADENA_DIRECTA_DE_NEON' DIRECT_URL='LA_CADENA_DIRECTA_DE_NEON' npx prisma studio
```

> Estás mirando **datos reales de estudiantes**. Consulta libremente; edita solo
> si sabes exactamente qué estás tocando.

También puedes usar la consola SQL que trae la propia web de Neon.

---

## 3. Cómo se cambia el esquema (de ahora en adelante)

El esquema tiene **historial versionado** en
[`backend/prisma/migrations/`](../backend/prisma/migrations). Esa carpeta es la
fuente de verdad, está en git, y es lo que se aplica en producción.

El ciclo completo, siempre en este orden:

```bash
# 1. Editas backend/prisma/schema.prisma

# 2. Generas la migración EN DESARROLLO (crea el SQL y lo aplica en tu base local)
cd backend && npx prisma migrate dev --name describe_el_cambio

# 3. Commiteas la carpeta de la migración junto con el cambio de código
git add prisma/migrations prisma/schema.prisma && git commit -m "..."

# 4. Producción la aplica sola: el startCommand de Render corre
#    `prisma migrate deploy` en cada despliegue. No hay que hacer nada a mano.
```

`migrate deploy` es idempotente: aplica solo lo pendiente y no toca nada más.

---

## 4. Respaldo

Neon tiene recuperación por punto en el tiempo, pero en la capa gratuita la
ventana es de **6 horas**. Para una tesis eso no alcanza: si un problema aparece
el lunes y los datos se corrompieron el viernes, no hay nada que recuperar.
**El respaldo propio no es opcional.**

```bash
# Contra Neon (usa la cadena DIRECTA):
DATABASE_URL='postgresql://…neon.tech/prexi?sslmode=require' ./scripts/respaldo-bd.sh

# Contra la base local de Docker:
./scripts/respaldo-bd.sh --local
```

El script [`scripts/respaldo-bd.sh`](../scripts/respaldo-bd.sh) guarda el dump en
`backups/` con la fecha en el nombre, avisa si sale vacío y **rota** conservando
los últimos 14 (`CONSERVAR=30` para cambiarlo).

**`backups/` está en `.gitignore` a propósito:** los dumps contienen correos,
hashes de contraseña y el desempeño de estudiantes reales. No los subas a
ningún repositorio ni a servicios de terceros sin pensarlo dos veces.

Recomendación práctica durante la recolección de datos: **un respaldo al final de
cada sesión con estudiantes**, y guarda una copia en otro dispositivo. Es un
comando de diez segundos.

---

## 5. Cómo RESTAURAR (el comando exacto)

Un respaldo que nadie sabe restaurar no sirve. Estos comandos están **probados**.

### Sobre una base local de prueba (lo que deberías hacer primero)

```bash
docker exec prexi-db psql -U prexi -d postgres -c "CREATE DATABASE prueba_restore;"
docker cp backups/EL_ARCHIVO.dump prexi-db:/tmp/t.dump
docker exec prexi-db pg_restore -U prexi -d prueba_restore /tmp/t.dump
docker exec prexi-db psql -U prexi -d prueba_restore -c "SELECT count(*) FROM usuarios;"
```

> En Git Bash de Windows, antepón `MSYS_NO_PATHCONV=1` a los comandos con rutas
> como `/tmp/t.dump`, o el shell las convertirá a rutas de Windows y fallarán.

### Sobre Neon

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d 'postgresql://…neon.tech/prexi?sslmode=require' backups/EL_ARCHIVO.dump
```

`--clean --if-exists` borra los objetos existentes antes de recrearlos: **el
contenido actual de esa base se reemplaza**. Asegúrate de estar apuntando a la
base correcta y de tener un dump reciente del estado actual antes de ejecutarlo.

---

## 6. Qué NUNCA hacer

| Nunca | Por qué |
|---|---|
| `prisma db push` contra producción | Reescribe el esquema sin historial y puede borrar columnas con datos. Producción solo usa `migrate deploy` |
| `prisma migrate dev` contra producción | Está pensado para desarrollo; puede pedir un reset de la base |
| `docker compose down -v` con datos que te importen | La `-v` **borra los volúmenes**, incluido `sap_pgdata`. Los datos se pierden y no hay papelera |
| Editar el SQL de una migración ya aplicada | Prisma valida por checksum; el despliegue fallará. Genera una migración nueva |
| Subir un `.dump` a un repositorio | Son datos personales de la investigación |
| Guardar PDFs enormes | Los PDF del docente se almacenan **dentro** de la base y Neon Free da 0.5 GB para todo. Si se supera, Neon **suspende el proyecto** |

---

## 7. Por qué los archivos viven dentro de la base

Los PDF del docente (`documentos.contenido`) y las portadas de unidad
(`unidades.imagen_datos`) se guardan como binarios en PostgreSQL, no en disco.

El motivo es el hosting: **Render Free no permite discos persistentes**, su
filesystem es efímero y se borra en cada reinicio, redeploy o despertar tras la
suspensión por inactividad — que ocurre cada 15 minutos sin tráfico. Guardarlos en
disco significaba perderlos constantemente, y con ellos el contexto documental que
usa PREXI. Como efecto secundario útil, ahora los archivos entran en el `pg_dump`
y se respaldan junto con todo lo demás.

El coste es que consumen del medio giga de Neon: unos 15 MB por PDF. Vigílalo con:

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

---

## 8. Migraciones del diseño no experimental transversal (octubre 2026)

La tesis adoptó un diseño **no experimental transversal**. Tres migraciones
alinean el esquema con él:

| Migración | Qué hace | ¿Destruye datos? |
|---|---|---|
| `retirar_grupos` | Elimina `usuarios.grupo`, el tipo `Grupo`, `configuracion_sistema.grupos_bloqueados` y la tabla obsoleta `perfil_adaptativo`. Agrega `encuesta_motivacion_activa`. | **Sí**: la asignación control/experimental se pierde. |
| `log_adaptacion` | Crea `log_adaptacion` (una fila por decisión del motor) e `historial_ranking`. Agrega el rango objetivo a la configuración. | No |
| `instrumentos_sus_iso25010` | Crea `respuestas_instrumento` (SUS e ISO/IEC 25010). Agrega la fase de evaluación y los umbrales de los criterios de aceptación. | No |

> ⚠ **Antes de desplegar esta rama en producción, respalda Neon** (sección 4).
> Render ejecuta `prisma migrate deploy` en cada despliegue, así que `retirar_grupos`
> se aplicará sola y **no tiene vuelta atrás**: la columna `grupo` desaparece.
> El respaldo local previo a estas migraciones quedó en
> `backend/prisma/backups/2026-10-11_pre-transversal.sql` (ignorado por git).

Qué tabla alimenta cada indicador de la tesis: [DISENO_INVESTIGACION.md](DISENO_INVESTIGACION.md).
