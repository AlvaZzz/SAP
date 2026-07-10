# 🗺️ Mapa del Sistema — PREXI

> **Guía de referencia del sistema completo**, organizada por rol. Sirve como
> mapa para navegar el código y como base para documentar la tesis.
>
> **PREXI** es la *herramienta de recolección de datos* de una investigación
> cuasi-experimental sobre el efecto de la **adaptatividad** y la **gamificación**
> en el aprendizaje de programación en Python. El sistema recolecta y muestra
> estadística **descriptiva**; la estadística **inferencial** (prueba t de
> Student) se realiza **fuera** del sistema (Google Colab) con el CSV exportado.

- **Institución:** UPEA (Ing. de Sistemas) · **Tutor IA:** ALVARO (Google Gemini)
- **Paleta:** azul `#1e3a5f` / `#2563eb` / `#dbeafe`, verde `#16a34a`, ámbar `#f59e0b`, rojo `#ef4444`. Modo claro/oscuro.

---

## 📑 Índice

1. [Arquitectura y stack](#1-arquitectura-y-stack)
2. [Modelo de datos (resumen)](#2-modelo-de-datos-resumen)
3. [Control de acceso por rol](#3-control-de-acceso-por-rol)
4. [Rol ESTUDIANTE](#4-rol-estudiante)
5. [Rol DOCENTE](#5-rol-docente)
6. [Rol INVESTIGADOR](#6-rol-investigador)
7. [Rol ADMINISTRADOR](#7-rol-administrador)
8. [Flujo de la investigación](#8-flujo-de-la-investigación)
9. [Tabla resumen de rutas (API)](#9-tabla-resumen-de-rutas-api)
10. [Qué hace el sistema y qué se hace fuera](#10-qué-hace-el-sistema-y-qué-se-hace-fuera)

---

## 1. Arquitectura y stack

### Screaming Architecture (un módulo por dominio)
El backend está organizado por **dominio de negocio**, no por capa técnica. Al mirar
`backend/src/` se "grita" lo que hace el sistema: `pretest/`, `postest/`, `ejercicios/`,
`retos/`, `docente-reportes/`, `investigador-exportacion/`, `admin-usuarios/`, etc.
Cada módulo NestJS agrupa su `*.controller.ts`, `*.service.ts`, `*.module.ts` y sus `dto/`.

### Separación backend / frontend
| Capa | Carpeta | Tecnología | Responsabilidad |
|---|---|---|---|
| **Backend (API)** | `backend/` | NestJS + Prisma | Toda la lógica: validación, cálculo de puntajes/XP, desbloqueos, ranking, guards de rol. **El frontend nunca calcula nada sensible.** |
| **Frontend (Web)** | `frontend/` | Next.js (App Router) | Solo muestra datos y envía peticiones. Grupos de ruta por rol. |
| **Base de datos** | PostgreSQL | Prisma ORM | Única fuente de verdad. |
| **Sandbox** | Piston | Contenedor aislado | Ejecuta el código Python del estudiante. |
| **IA (ALVARO)** | Google Gemini | `tutor-ia/` | La API key vive solo en el backend; nunca se expone al cliente. |

### Stack completo
- **Backend:** NestJS, Prisma ORM, PostgreSQL, JWT (cookie httpOnly), class-validator.
- **Frontend:** Next.js App Router, React, Tailwind (tokens de tema claro/oscuro), lucide-react.
- **IA:** Google Gemini (`@google/generative-ai`).
- **Ejecución de código:** Piston (sandbox de Python 3).
- **Infra:** Docker Compose (`db`, `api`, `web`, `piston`). El `docker-entrypoint.sh` aplica el schema (`prisma db push`) y siembra la BD al arrancar.

### Convención de rutas del frontend
Los grupos `(estudiante)`, `(docente)`, `(investigador)`, `(admin)` son **transparentes en la URL**:
- Estudiante → rutas en la **raíz** (`/dashboard`, `/ejercicios`, `/pretest`…).
- Docente → prefijo `/docente/*`.
- Investigador → prefijo `/investigador/*`.
- Admin → prefijo `/admin/*`.

---

## 2. Modelo de datos (resumen)

Tablas principales (Prisma → PostgreSQL). Todas se leen/escriben solo desde el backend.

| Tabla | Para qué sirve |
|---|---|
| `Usuario` | Cuentas. Campos clave: `rol`, `grupo` (control/experimental), `institucion`, `activo` (soft-disable), `pretestCompletado`, `nivelInicial`. |
| `Nivel` | Los 5 niveles temáticos (Variables → Estructuras de datos) con su `umbral`. |
| `Ejercicio` | Banco de contenido. `banco` = `practica` \| `pretest` \| `postest`; `activo` para publicar/ocultar. |
| `Intento` | Cada respuesta a un ejercicio de práctica (correcto, tiempo, XP otorgado). **Inmutable.** |
| `ProgresoNivel` | Avance del estudiante por nivel + desbloqueo. |
| `Evaluacion` | Resultado **persistido** de pretest/postest (`puntajeTotal`, `porCategoria`, `tiempoSeg`). **Fuente de verdad del resultado.** |
| `PretestRespuesta` | Autosave por pregunta del pre/postest (opción elegida, correcto) → alimenta la Revisión. |
| `Ranking` | XP total, racha, posición. |
| `Logro` / `LogroUsuario` | Insignias de gamificación. |
| `ConsultaIa` | Cada consulta a ALVARO (auditoría de costos + dato de investigación + rate limit). |
| `Documento` | PDFs subidos por docentes (archivo con nombre UUID opaco). |
| `Reto` / `RetoUsuario` | Retos del docente y su entrega/estado/feedback/XP. |
| `NotaDocente` | Observación del docente sobre un estudiante. |
| `Notificacion` | Campana del estudiante (ej. "tu reto fue revisado"). |
| `CodigoPractica` | Guardado del código de la Zona de Práctica. |
| `ConfiguracionSistema` | **Fila única (id=1).** Parámetros centralizados que TODO el sistema lee. |
| `LogAuditoria` | Traza de acciones sensibles del admin. |

---

## 3. Control de acceso por rol

- El **JWT** distingue el rol: `estudiante` · `docente` · `investigador` · `admin`.
- **Guards server-side:** `JwtAuthGuard` (autenticación) + `RolesGuard` (`@Roles(...)`).
  Ningún rol accede a rutas de otro **aunque conozca la URL** (recibe `403`).
- **Redirección tras login (frontend):** estudiante → `/dashboard` (o `/pretest` si falta),
  docente → `/docente/dashboard`, investigador → `/investigador/panel`, admin → `/admin/dashboard`.
- El **admin** es el de mayor privilegio (puede ver todas las áreas), pero sus acciones quedan **auditadas**.
- Cuentas **desactivadas** (`activo=false`) no pueden iniciar sesión.

| Token \ Ruta | `/admin/*` | `/docente/*` | `/investigador/*` | Rutas de estudiante |
|---|:--:|:--:|:--:|:--:|
| Estudiante | 403 | 403 | 403 | ✅ |
| Docente | 403 | ✅ | 403 | 403 |
| Investigador | 403 | 403 | ✅ | 403 |
| Admin | ✅ | ✅ | ✅ | ✅ |

---

## 4. Rol ESTUDIANTE

**Propósito:** es quien **genera los datos** de la investigación. Recorre una ruta de
aprendizaje adaptativa y gamificada de Python, apoyado por el tutor IA ALVARO.

**Backend (módulos):** `pretest/`, `postest/`, `ejercicios/`, `practica/`, `tutor-ia/`,
`documentos/`, `retos/`, `gamificacion/`, `ranking/`, `progreso/`, `notificaciones/`.

| Apartado | Ruta | Qué hace | Enganche | Datos |
|---|---|---|---|---|
| **Registro / Login** | `/registro`, `/login` | Alta pública (solo estudiantes) e ingreso. JWT en cookie httpOnly; bloqueo por intentos fallidos. | El **admin** crea el resto de roles. | Crea `Usuario` + `Ranking`. |
| **Pretest (obligatorio)** | `/pretest` | 20 preguntas del **banco pretest**, con timer y autosave, **sin ALVARO**. Al terminar clasifica el nivel inicial. | Se exige antes del dashboard. Alimenta reportes del docente y del investigador. | Escribe `PretestRespuesta` (autosave) y `Evaluacion` (tipo `pre`). |
| **Resultado pretest** | `/pretest/resultado` | Muestra puntaje real, nivel (Bajo/Medio/Alto), fortalezas y debilidades por categoría. | — | Lee `Evaluacion` (pre). |
| **Revisión de respuestas** | `/pretest/revision`, `/postest/revision` | Enumera cada pregunta: opción elegida, correcta y **explicación** (`explicacionIa`). Filtro correctas/incorrectas. | — | Lee `PretestRespuesta` + `Ejercicio`. |
| **Dashboard** | `/dashboard` | Resumen: XP, posición, racha, meta, actividad semanal, comparativa pre/post, recomendados de ALVARO. Tarjeta destacada del postest cuando se desbloquea. | Recomendados usan la actividad real. | Lee `Ranking`, `Intento`, `Evaluacion`. |
| **Ejercicios (5 niveles)** | `/ejercicios`, `/ejercicios/[id]` | Resolver ejercicios de práctica. La **corrección, el XP y el desbloqueo se calculan en el backend**. ALVARO da pistas (penalizan XP). | El **docente** crea/edita/activa estos ejercicios. | Escribe `Intento`, actualiza `ProgresoNivel`, `Ranking`, `LogroUsuario`. |
| **Zona de práctica** | `/practica` | Editor de código + ejecución en sandbox (Piston) + chat con ALVARO que **orienta sobre el código, no lo resuelve**. Aquí se **entregan los retos**. | ALVARO (`tutor-ia`); retos del docente. | Escribe `CodigoPractica`, `ConsultaIa`; al entregar, `RetoUsuario`. |
| **Documentos** | `/documentos` | Ver/descargar PDFs del curso con "Subido por · fecha · tamaño". | El **docente** los sube. | Lee `Documento` (stream seguro). |
| **Retos** | `/retos` | Retos extra del docente. Estado por reto: nuevo / en revisión / aprobado / a mejorar, con feedback y XP. | Se resuelven en `/practica`; los revisa el **docente**. | Lee/escribe `RetoUsuario`. |
| **Progreso** | `/progreso` | Comparativa pretest vs postest por categoría del propio estudiante. | — | Lee `Evaluacion`. |
| **Ranking** | `/ranking` | Tabla de posiciones por XP. | Se alimenta de la actividad de todos. | Lee `Ranking`. |
| **Perfil** | `/perfil` | Datos personales, cambio de contraseña. | — | Lee/escribe `Usuario`. |
| **Postest (desbloqueable)** | `/postest` | 20 preguntas del **banco postest** (distinto al pretest), timer y autosave, **sin ALVARO**. Se habilita al completar el avance configurado (ej. Nivel 3). | Umbral definido por el **admin** (`postestDesdeNivel`). | Escribe `PretestRespuesta` (post) y `Evaluacion` (post). |
| **Resultado postest** | `/postest/resultado` | Puntaje real, aciertos, **ganancia = postest − pretest**, fortalezas/debilidades por categoría. | — | Lee `Evaluacion` (pre y post). |
| **Campana de notificaciones** | (topbar) | Badge de no leídas, lista, marcar leídas, enlace al contenido. | La dispara la **revisión de retos** del docente. | Lee/escribe `Notificacion`. |

> **Regla clave:** el resultado de un pretest/postest **completado** se lee de la
> `Evaluacion` **persistida**, nunca se recalcula desde `PretestRespuesta` (que puede
> quedar vacía). Así se evita el bug de "0/100".

---

## 5. Rol DOCENTE

**Propósito:** **controla y alimenta** lo que el estudiante consume (ejercicios, retos,
documentos), **revisa** sus entregas y **da seguimiento** a su progreso. Gestión pedagógica.

**Backend (módulos):** `docente-dashboard/`, `docente-ejercicios/`, `docente-retos/`,
`docente-revisiones/`, `docente-documentos/`, `docente-estudiantes/`, `docente-reportes/`.

| Apartado | Ruta | Qué hace | Enganche | Datos |
|---|---|---|---|---|
| **Dashboard** | `/docente/dashboard` | Estudiantes activos, completados hoy, XP promedio, en riesgo, **entregas por revisar**, distribución por nivel, actividad reciente. | Compone seguimiento + revisiones. | Lee `Intento`, `Usuario`, `RetoUsuario`. |
| **Gestión de ejercicios** | `/docente/ejercicios` | CRUD de los ejercicios de los 5 niveles (nivel, categoría, dificultad, tipo, enunciado, código, opciones, respuesta, XP, `explicacionIa`). Activar/desactivar. Filtros. | Lo creado aparece **de inmediato** en `/ejercicios` del estudiante. | Escribe `Ejercicio` (banco `practica`). |
| **Gestión de retos** | `/docente/retos` | CRUD de retos extra: título, categoría, **nivel opcional**, dificultad, enunciado, código base, **ejemplo entrada/salida**, XP, **fecha límite**, borrador/publicado. | Al publicar aparece en `/retos` del estudiante con autor y fecha. | Escribe `Reto`. |
| **Revisión de retos** ⭐ | `/docente/revisiones` | Lista entregas pendientes; ve el **código del estudiante** con resaltado; marca **Aprobado / Necesita mejorar**, asigna **XP** y escribe **feedback**. Botón "**Sugerir con ALVARO**" (borrador de Gemini). | Otorga XP (ranking) y **dispara notificación** al estudiante. | Lee/escribe `RetoUsuario`, `Ranking`, `Notificacion`. |
| **Documentos** | `/docente/documentos` | Subir PDFs (título, nivel, descripción). Validación real de PDF + límite de tamaño + nombre UUID opaco. Editar/eliminar los propios. | Aparecen en `/documentos` del estudiante. | Escribe `Documento`. |
| **Seguimiento de estudiantes** | `/docente/estudiantes` | Lista con nivel, XP, ejercicios, última sesión y **estado** (en progreso/completado/inactivo/en riesgo). Detalle: progreso por nivel, actividad, historial, pre/postest y **nota del docente**. | Todo desde actividad **real**; umbral de "en riesgo" lo fija el **admin**. | Lee `Intento`, `Evaluacion`, `Ranking`; escribe `NotaDocente`. |
| **Reportes** ⭐ | `/docente/reportes` | Tabs: **Pretest vs Postest** (por categoría + tabla por estudiante con ganancia), **Progreso por nivel** (con tiempo promedio), **Actividad semanal**. **Exporta CSV**. | Insumo pedagógico; se complementa con el rol investigador. | Lee `Evaluacion`, `Intento`. |

> El docente solo gestiona/edita/elimina **su propio** contenido (autor validado contra el JWT).

---

## 6. Rol INVESTIGADOR

**Propósito:** rol de **solo lectura** que **consolida y exporta** los datos del estudio
para demostrar el efecto de la adaptatividad y la gamificación. **No** administra usuarios ni
configura el sistema; **no** duplica funciones del docente ni del admin.

**Backend (módulos):** `investigador-panel/`, `investigador-resultados/`,
`investigador-datos/`, `investigador-exportacion/`.

| Apartado | Ruta | Qué hace | Enganche | Datos |
|---|---|---|---|---|
| **Panel del estudio** | `/investigador/panel` | Muestra total, control vs experimental, desglose por institución/cohorte, avance de la recolección (cuántos rindieron pre/postest) y fechas. | El **admin** asigna los grupos que aquí se cuentan. | Lee `Usuario`, `Evaluacion`. |
| **Resultados** | `/investigador/resultados` | Comparativa pretest/postest **por grupo**, **ganancia media** control vs experimental, comparativa por categoría y **estadística descriptiva** (media, desv. estándar, mín, máx). **Solo descriptiva.** | Reutiliza el dataset canónico. | Lee `Evaluacion`. |
| **Datos complementarios** | `/investigador/datos` | Relación **descriptiva** entre uso del sistema (XP, ejercicios, consultas a ALVARO, pistas) y la **ganancia**. Dispersión + promedios por grupo + ganancia por nivel de práctica. | Evidencia de apoyo (no causalidad). | Lee `Evaluacion`, `Intento`, `ConsultaIa`, `RetoUsuario`. |
| **Exportación** ⭐ | `/investigador/exportacion` | Vista previa + **descarga del CSV consolidado y ANONIMIZADO** (`id_anonimo`, sin nombres/correos/cédulas), una fila por estudiante, con el **grupo** y todas las métricas. Insumo directo para la prueba t. | El grupo lo asigna el **admin**; los puntajes los generan los **estudiantes**. | Lee todo (solo lectura). |

> **Fuente única de verdad:** `investigador-exportacion` construye el dataset; resultados y
> datos lo **reutilizan**. Los números del investigador coinciden con los del docente y el admin.

---

## 7. Rol ADMINISTRADOR

**Propósito:** gestión **técnica** del sistema y **habilitador del diseño cuasi-experimental**
(asigna los grupos). Es soporte técnico: **no** hace el análisis de la tesis (eso es del
investigador). Acciones **auditadas**.

**Backend (módulos):** `admin-dashboard/`, `admin-usuarios/`, `admin-grupos/`,
`admin-config/`, `admin-auditoria/`.

| Apartado | Ruta | Qué hace | Enganche | Datos |
|---|---|---|---|---|
| **Dashboard** | `/admin/dashboard` | Totales de usuarios, activos, docentes/admins, ejercicios, **por revisar**; distribución por rol; estado del estudio (control vs experimental, enlaza al investigador); registros por semana; actividad reciente (auditoría). | Vista global; coincide con docente e investigador. | Lee `Usuario`, `Ejercicio`, `LogAuditoria`. |
| **Gestión de usuarios** | `/admin/usuarios` | CRUD de **todos los roles** (crea docentes, investigadores y admins que no se registran públicamente). Filtros, búsqueda, **activar/desactivar** (soft-disable), **reset de contraseña** (temporal, sin ver la actual). Valida correo/cédula únicos. | Un usuario creado puede iniciar sesión en su rol; uno desactivado no. | Escribe `Usuario`; registra en `LogAuditoria`. |
| **Grupos de investigación** ⭐ | `/admin/grupos` | Asigna cada estudiante a **control** o **experimental** (individual o masivo) + institución. Conteos y balance. **Bloqueo** de cambios una vez iniciada la recolección (con confirmación/forzar). | **Sin esta asignación no hay comparación estadística.** El investigador la consume. | Escribe `Usuario.grupo`/`institucion`; audita. |
| **Configuración del sistema** | `/admin/sistema` | Tabs **General** (nombre, institución, periodo, logo), **Gamificación** (XP, bonus racha, umbral de nivel), **IA** (activar ALVARO, máx. pistas, **rate limit**, modo de retro), **Investigación** (umbral de postest, bloqueo de grupos, umbrales de "en riesgo"). | **TODO el sistema lee de aquí** (estudiante e IA), nada hardcodeado. | Lee/escribe `ConfiguracionSistema`; audita. |
| **Auditoría** | `/admin/auditoria` | Registro de acciones sensibles (crear/editar/desactivar usuario, cambio de rol, cambio de grupo, cambio de config, reset de contraseña) con filtros por acción y fecha. | Trazabilidad para la seriedad del estudio. | Lee `LogAuditoria`. |

> **Límites del admin:** nunca ve contraseñas (solo fuerza reseteo); **no** edita datos de
> medición (pretest/postest/intentos son inmutables); no puede desactivarse ni quitarse su
> propio rol admin.

---

## 8. Flujo de la investigación

Recorrido de los datos desde que se generan hasta que salen para el análisis externo:

```
   ADMIN                    ESTUDIANTE                     DOCENTE            INVESTIGADOR
     │                          │                             │                    │
 1) crea usuarios          2) rinde PRETEST ──► Evaluacion(pre)                    │
    (docente/invest.)          │  (20 preg. banco pretest, sin ALVARO)            │
     │                         │                                                   │
 3) asigna GRUPO ─────────► Usuario.grupo                                          │
    control / experimental     │  (control | experimental) + institución          │
     │                         │                                                   │
 4) fija parámetros        5) resuelve ejercicios, usa ALVARO, entrega retos       │
    (config central)           │  ──► Intento / Ranking / ConsultaIa / RetoUsuario │
     │                         │                              │                    │
     │                         │                       6) revisa retos ──► XP+notif │
     │                         │                                                   │
     │                     7) rinde POSTEST ──► Evaluacion(post)                   │
     │                         │  (se desbloquea al completar el avance)          │
     │                         │       ganancia = post − pre                       │
     │                         │                              │                    │
     └─────────────────────────┴──────────────────────────────┴──► 8) EXPORTA CSV ─┘
                                                                     anonimizado + grupo
                                                                          │
                                                                          ▼
                                                     9) PRUEBA t de STUDENT (Google Colab)
                                                        — FUERA del sistema —
```

1. **Admin** crea las cuentas de docentes e investigadores (los estudiantes se registran solos).
2. Cada **estudiante** rinde el **pretest** obligatorio → se persiste `Evaluacion(pre)`.
3. **Admin** asigna a cada estudiante al grupo **control** o **experimental** (y su institución).
   *Este paso habilita la comparación; sin grupos no hay prueba t posible.*
4. **Admin** configura los parámetros (umbral de postest, gamificación, IA) que consume todo el sistema.
5. El **estudiante** usa el sistema (ejercicios, ALVARO, retos) → genera actividad real.
6. El **docente** revisa retos, otorga XP y feedback → notifica al estudiante.
7. Al completar el avance configurado, el estudiante rinde el **postest** → `Evaluacion(post)` y **ganancia = post − pre**.
8. El **investigador** exporta el **CSV anonimizado** (una fila por estudiante, con el grupo y todas las métricas).
9. La **prueba t de Student** se ejecuta **fuera del sistema** (Google Colab) sobre ese CSV.

**El sistema recolecta y describe; NO calcula la prueba t.**

---

## 9. Tabla resumen de rutas (API)

Prefijo global: `/api`. Todas requieren JWT salvo login/registro. Las de rol usan `RolesGuard`.

### Autenticación
| Método | Ruta | Función |
|---|---|---|
| POST | `/api/auth/register` | Registro público (solo estudiantes). |
| POST | `/api/auth/login` | Ingreso (JWT en cookie). |
| POST | `/api/auth/logout` | Cierre de sesión. |
| GET | `/api/auth/me` | Usuario actual. |
| PUT | `/api/auth/perfil` · `/api/auth/password` | Editar perfil / cambiar contraseña. |

### Estudiante
| Método | Ruta | Función |
|---|---|---|
| GET | `/api/pretest/estado` · `/preguntas` · `/revision` | Estado, 20 preguntas, revisión del pretest. |
| POST | `/api/pretest/responder` · `/finalizar` | Autosave y cierre del pretest. |
| GET | `/api/postest/estado` · `/preguntas` · `/revision` | Estado (desbloqueo), 20 preguntas, revisión del postest. |
| POST | `/api/postest/responder` · `/finalizar` | Autosave y cierre del postest. |
| GET | `/api/niveles` · `/ejercicios` · `/ejercicios/:id` · `/ejercicios/resueltos` | Niveles y ejercicios de práctica. |
| POST | `/api/intentos` | Registrar intento (corrección + XP + desbloqueo, **backend**). |
| GET | `/api/gamificacion/resumen` · `/logros` · `/recomendados` · `/actividad` | Datos del dashboard. |
| GET | `/api/ranking` · `/progreso` · `/progreso/export.csv` | Ranking y progreso. |
| POST | `/api/practica/ejecutar` · `/asistir` · GET/PUT `/practica/codigo` | Ejecutar código, ALVARO, guardar código. |
| POST | `/api/tutor-ia/asistente` · `/pista` · `/practica` · `/retroalimentacion` | ALVARO (sujeto a `iaActiva` y rate limit de la config). |
| GET | `/api/documentos` · `/documentos/:id/archivo` | Listar / descargar PDFs. |
| GET | `/api/retos` · `/retos/:id` · `/retos/mis-entregas` | Retos y entregas. |
| POST | `/api/retos/:id/entregar` | Entregar un reto (queda pendiente de revisión). |
| GET | `/api/notificaciones` · `/conteo` · POST `/:id/leer` · `/leer-todas` | Campana de notificaciones. |

### Docente (`@Roles('docente','admin')`)
| Método | Ruta | Función |
|---|---|---|
| GET | `/api/docente/dashboard` | Resumen del grupo. |
| GET/POST/PUT/PATCH/DELETE | `/api/docente/ejercicios[...]` | CRUD de ejercicios + `categorias` + activar. |
| GET/POST/PUT/PATCH/DELETE | `/api/docente/retos[...]` | CRUD de retos + activar. |
| GET | `/api/docente/revisiones` | Entregas por revisar. |
| POST | `/api/docente/revisiones/:retoId/:estudianteId` | Calificar (aprobar/mejorar + XP + feedback + notif). |
| POST | `/api/docente/revisiones/:retoId/:estudianteId/sugerir` | Borrador de feedback con ALVARO. |
| GET/POST/PUT/DELETE | `/api/docente/documentos[...]` | Gestión de PDFs. |
| GET | `/api/docente/estudiantes` · `/:id` | Lista y detalle de seguimiento. |
| PUT | `/api/docente/estudiantes/:id/nota` | Guardar nota del docente. |
| GET | `/api/docente/reportes/pretest-postest` · `/progreso-niveles` · `/actividad-semanal` · `/export.csv` | Reportes + exportación. |

### Investigador (`@Roles('investigador','admin')`)
| Método | Ruta | Función |
|---|---|---|
| GET | `/api/investigador/panel` | Resumen y avance del estudio. |
| GET | `/api/investigador/resultados` | Descriptivos pre/post por grupo. |
| GET | `/api/investigador/datos` | Relación uso ↔ mejora. |
| GET | `/api/investigador/exportacion/dataset` · `/export.csv` | Vista previa y **CSV anonimizado**. |

### Admin (`@Roles('admin')`)
| Método | Ruta | Función |
|---|---|---|
| GET | `/api/admin/dashboard` | Estado técnico del sistema. |
| GET/POST/PUT/PATCH | `/api/admin/usuarios[...]` | CRUD, estado y reset de contraseña. |
| GET | `/api/admin/grupos` · POST `/asignar` | Ver y asignar grupos de investigación. |
| GET/PUT | `/api/admin/config` | Leer/actualizar la configuración central. |
| GET | `/api/admin/auditoria` | Registro de acciones sensibles. |

---

## 10. Qué hace el sistema y qué se hace fuera

| Dentro del sistema (PREXI) | Fuera del sistema |
|---|---|
| Recolecta datos de la **actividad real** (pretest/postest, ejercicios, uso de IA, gamificación). | El **análisis inferencial**. |
| Asigna grupos control/experimental (admin). | La **prueba t de Student** (Google Colab). |
| Muestra estadística **descriptiva**: medias, desviación estándar, mínimos/máximos, **ganancia** por grupo. | El cálculo de **significancia** (valor *p*). |
| **Exporta** el dataset anonimizado (CSV) con el grupo por estudiante. | La **interpretación** y redacción en la tesis. |

> **En una frase:** PREXI es la herramienta que *recolecta, describe y exporta* los datos;
> la *inferencia estadística* que demuestra el efecto se hace fuera, con el CSV, y se documenta
> en la tesis.

---

*Documento generado como mapa de referencia del sistema PREXI. Rutas y módulos verificados
contra el código en ejecución.*
