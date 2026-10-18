# 🗺️ Mapa del Sistema — PREXI

> **Guía de referencia del sistema completo**, organizada por rol. Sirve como
> mapa para navegar el código y como base para documentar la tesis.
>
> **PREXI** es un sistema adaptativo con gamificación para aprender programación en
> Python, y a la vez el objeto de una investigación **no experimental transversal**:
> al final del período de uso se evalúa **si el sistema funciona bien** (precisión del
> motor adaptativo, usabilidad percibida y calidad del software). El sistema registra,
> calcula y exporta esos indicadores; el análisis definitivo se hace fuera, con
> Python, Pandas y SciPy. Ver [DISENO_INVESTIGACION.md](DISENO_INVESTIGACION.md).

- **Institución:** UPEA (Ing. de Sistemas) · **Tutor IA:** PREXI (Google Gemini)
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
| **Ejecución de Python** | Pyodide | Navegador del estudiante | El código nunca llega al servidor: corre en un web worker con CPython/WebAssembly. |
| **IA (PREXI)** | Google Gemini | `tutor-ia/` | La API key vive solo en el backend; nunca se expone al cliente. |

### Stack completo
- **Backend:** NestJS, Prisma ORM, PostgreSQL, JWT (cookie httpOnly), class-validator.
- **Frontend:** Next.js App Router, React, Tailwind (tokens de tema claro/oscuro), lucide-react.
- **IA:** Google Gemini (`@google/generative-ai`).
- **Ejecución de código:** Pyodide (CPython 3 en WebAssembly), en el navegador del estudiante.
- **Infra (desarrollo):** Docker Compose (`db`, `api`, `web`). El `docker-entrypoint.sh` aplica las migraciones versionadas (`prisma migrate deploy`) y siembra la BD si está vacía.
- **Infra (producción):** Render (backend) + Vercel (frontend) + Neon (PostgreSQL). Ver [DESPLIEGUE.md](DESPLIEGUE.md).

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
| `Usuario` | Cuentas. Campos clave: `rol`, `paralelo`, `institucion`, `activo` (soft-disable), `pretestCompletado`, `nivelInicial`. |
| `Nivel` | Los 5 niveles temáticos (Variables → Estructuras de datos) con su `umbral`. |
| `Ejercicio` | Banco de contenido. `banco` = `practica` \| `pretest` \| `postest`; `activo` para publicar/ocultar. |
| `Intento` | Cada respuesta a un ejercicio de práctica (correcto, tiempo, XP otorgado). **Inmutable.** |
| `ProgresoNivel` | Avance del estudiante por nivel + desbloqueo. |
| `Evaluacion` | Resultado **persistido** de pretest/postest (`puntajeTotal`, `porCategoria`, `tiempoSeg`). **Fuente de verdad del resultado.** |
| `PretestRespuesta` | Autosave por pregunta del pre/postest (opción elegida, correcto) → alimenta la Revisión. |
| `Ranking` | XP total, racha, posición. |
| `Logro` / `LogroUsuario` | Insignias de gamificación. |
| `ConsultaIa` | Cada consulta a PREXI (auditoría de costos + dato de investigación + rate limit). |
| `Documento` | PDFs subidos por docentes (archivo con nombre UUID opaco). |
| `Reto` / `RetoUsuario` | Retos del docente y su entrega/estado/feedback/XP. |
| `NotaDocente` | Observación del docente sobre un estudiante. |
| `Notificacion` | Campana del estudiante (ej. "tu reto fue revisado"). |
| `CodigoPractica` | Guardado del código de la Zona de Práctica. |
| `ConfiguracionSistema` | **Fila única (id=1).** Parámetros centralizados que TODO el sistema lee. |
| `LogAuditoria` | Traza de acciones sensibles del admin. |
| `LogAdaptacion` | **Log del motor adaptativo**: una fila por decisión (θ, dificultad, P esperada, ¿en rango objetivo?, latencia). Instrumento de la tesis. |
| `HistorialRanking` | Cada cambio de posición en el ranking (indicador de gamificación). |
| `RespuestaInstrumento` | Respuestas crudas al SUS (estudiantes) y al cuestionario ISO/IEC 25010 (docentes y evaluadores). Una aplicación por usuario y versión. |

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
aprendizaje adaptativa y gamificada de Python, apoyado por el tutor IA PREXI.

**Backend (módulos):** `pretest/`, `postest/`, `ejercicios/`, `practica/`, `tutor-ia/`,
`documentos/`, `retos/`, `gamificacion/`, `ranking/`, `progreso/`, `notificaciones/`.

| Apartado | Ruta | Qué hace | Enganche | Datos |
|---|---|---|---|---|
| **Registro / Login** | `/registro`, `/login` | Alta pública (solo estudiantes) e ingreso. JWT en cookie httpOnly; bloqueo por intentos fallidos. | El **admin** crea el resto de roles. | Crea `Usuario` + `Ranking`. |
| **Pretest (obligatorio)** | `/pretest` | 20 preguntas del **banco pretest**, con timer y autosave, **sin PREXI**. Al terminar clasifica el nivel inicial. | Se exige antes del dashboard. Alimenta reportes del docente y del investigador. | Escribe `PretestRespuesta` (autosave) y `Evaluacion` (tipo `pre`). |
| **Resultado pretest** | `/pretest/resultado` | Muestra puntaje real, nivel (Bajo/Medio/Alto), fortalezas y debilidades por categoría. | — | Lee `Evaluacion` (pre). |
| **Revisión de respuestas** | `/pretest/revision`, `/postest/revision` | Enumera cada pregunta: opción elegida, correcta y **explicación** (`explicacionIa`). Filtro correctas/incorrectas. | — | Lee `PretestRespuesta` + `Ejercicio`. |
| **Dashboard** | `/dashboard` | Resumen: XP, posición, racha, meta, actividad semanal, comparativa pre/post, recomendados de PREXI. Tarjeta destacada del postest cuando se desbloquea. | Recomendados usan la actividad real. | Lee `Ranking`, `Intento`, `Evaluacion`. |
| **Ejercicios (5 niveles)** | `/ejercicios`, `/ejercicios/[id]` | Resolver ejercicios de práctica. La **corrección, el XP y el desbloqueo se calculan en el backend**. PREXI da pistas (penalizan XP). | El **docente** crea/edita/activa estos ejercicios. | Escribe `Intento`, actualiza `ProgresoNivel`, `Ranking`, `LogroUsuario`. |
| **Zona de práctica** | `/practica` | Editor de código + ejecución en el navegador (Pyodide) + chat con PREXI que **orienta sobre el código, no lo resuelve**. Aquí se **entregan los retos**. | PREXI (`tutor-ia`); retos del docente. | Escribe `CodigoPractica`, `ConsultaIa`; al entregar, `RetoUsuario`. |
| **Documentos** | `/documentos` | Ver/descargar PDFs del curso con "Subido por · fecha · tamaño". | El **docente** los sube. | Lee `Documento` (stream seguro). |
| **Retos** | `/retos` | Retos extra del docente. Estado por reto: nuevo / en revisión / aprobado / a mejorar, con feedback y XP. | Se resuelven en `/practica`; los revisa el **docente**. | Lee/escribe `RetoUsuario`. |
| **Progreso** | `/progreso` | Comparativa pretest vs postest por categoría del propio estudiante. | — | Lee `Evaluacion`. |
| **Ranking** | `/ranking` | Tabla de posiciones por XP. | Se alimenta de la actividad de todos. | Lee `Ranking`. |
| **Perfil** | `/perfil` | Datos personales, cambio de contraseña. | — | Lee/escribe `Usuario`. |
| **Postest (desbloqueable)** | `/postest` | 20 preguntas del **banco postest** (distinto al pretest), timer y autosave, **sin PREXI**. Se habilita al completar el avance configurado (ej. Nivel 3). | Umbral definido por el **admin** (`postestDesdeNivel`). | Escribe `PretestRespuesta` (post) y `Evaluacion` (post). |
| **Resultado postest** | `/postest/resultado` | Puntaje real, aciertos, **avance = postest − diagnóstico**, fortalezas/debilidades por categoría. | — | Lee `Evaluacion` (pre y post). |
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
| **Revisión de retos** ⭐ | `/docente/revisiones` | Lista entregas pendientes; ve el **código del estudiante** con resaltado; marca **Aprobado / Necesita mejorar**, asigna **XP** y escribe **feedback**. Botón "**Sugerir con PREXI**" (borrador de Gemini). | Otorga XP (ranking) y **dispara notificación** al estudiante. | Lee/escribe `RetoUsuario`, `Ranking`, `Notificacion`. |
| **Documentos** | `/docente/documentos` | Subir PDFs (título, nivel, descripción). Validación real de PDF + límite de tamaño + nombre UUID opaco. Editar/eliminar los propios. | Aparecen en `/documentos` del estudiante. | Escribe `Documento`. |
| **Seguimiento de estudiantes** | `/docente/estudiantes` | Lista con nivel, XP, ejercicios, última sesión y **estado** (en progreso/completado/inactivo/en riesgo). Detalle: progreso por nivel, actividad, historial, pre/postest y **nota del docente**. | Todo desde actividad **real**; umbral de "en riesgo" lo fija el **admin**. | Lee `Intento`, `Evaluacion`, `Ranking`; escribe `NotaDocente`. |
| **Reportes** ⭐ | `/docente/reportes` | Tabs: **Pretest vs Postest** (por categoría + tabla por estudiante con su avance), **Progreso por nivel** (con tiempo promedio), **Actividad semanal**. **Exporta CSV**. | Insumo pedagógico; se complementa con el rol investigador. | Lee `Evaluacion`, `Intento`. |

> El docente solo gestiona/edita/elimina **su propio** contenido (autor validado contra el JWT).

---

## 6. Rol INVESTIGADOR

**Propósito:** rol de **solo lectura** que **calcula y exporta** los indicadores del estudio
(diseño **no experimental transversal**): precisión del motor adaptativo, usabilidad percibida
y calidad del producto de software. **No** administra usuarios ni configura el sistema.

**Backend (módulos):** `investigador-panel/`, `investigador-analisis/`,
`investigador-validacion/`, `investigador-exportacion/`.

| Apartado | Ruta | Qué hace | Datos |
|---|---|---|---|
| **Diseño y muestra** | `/investigador/panel` | Muestra total, estudiantes por paralelo, período de uso y **ficha metodológica** (diseño, población, instrumentos, variables, hipótesis). | Lee `Usuario`, `Evaluacion`, `Intento`. |
| **Participantes y uso** | `/investigador/validez` | Cascada registrados → diagnóstico → uso real → evaluación final, datos faltantes y uso del sistema. | Dataset canónico. |
| **Validación del sistema** ⭐ | `/investigador/validacion` | Los indicadores de la tesis: **% de asignaciones en rango objetivo con IC 95 % por bootstrap**, latencia de reajuste, **puntaje medio SUS**, **calidad ISO/IEC 25010** por característica, variable independiente descrita y **tabla de criterios de aceptación**. | Lee `LogAdaptacion`, `RespuestaInstrumento`, `HistorialRanking`, `RetoUsuario`. |
| **Fiabilidad del diagnóstico** | `/investigador/fiabilidad` | KR-20, dificultad y discriminación por ítem y ajuste de Rasch del diagnóstico y de la evaluación final. | Lee `PretestRespuesta`. |
| **Mecanismo adaptativo** | `/investigador/clasificacion` | Validación de la clasificación por niveles (umbrales θ). | Lee `Intento`, `ProgresoTema`. |
| **Exportación** ⭐ | `/investigador/exportacion` | **Un CSV anonimizado por instrumento** (`log_adaptacion`, `sus`, `iso25010`, `uso_gamificacion`), dataset principal, codebook, metadatos del corte con hash y ética. | Lee todo (solo lectura). |

> **Sin datos personales:** todas las exportaciones usan `id_anonimo` (sin nombre, CI, RU ni correo).

---

## 7. Rol ADMINISTRADOR

**Propósito:** gestión **técnica** del sistema. Es soporte técnico: **no** hace el análisis de
la tesis (eso es del investigador). Acciones **auditadas**.

**Backend (módulos):** `admin-dashboard/`, `admin-usuarios/`, `admin-cursos/`, `admin-contenido/`, `admin-config/`, `admin-auditoria/`.

El menú se agrupa como el del docente: **Inicio** (Panel), **Personas y cursos** (Usuarios, Cursos y docentes), **Contenido**, **Sistema** (Configuración, Auditoría) y **Otras áreas** (docente e investigación, con un enlace para volver al panel admin).

| Apartado | Ruta | Qué hace | Enganche | Datos |
|---|---|---|---|---|
| **Panel** | `/admin/dashboard` | Saludo y **«Requiere tu atención»**: IA sin clave o apagada, paralelos sin docente, solicitudes de inscripción, cuentas bloqueadas, temas sin 10 ejercicios por nivel y exámenes de menos de 10 preguntas; cada aviso lleva a donde se resuelve. Números del sistema, accesos directos, personas por rol, estado del sistema (IA, contenido, evaluación), cuentas nuevas por semana y actividad reciente. | Vista global. | Lee `Usuario`, `Paralelo`, `Ejercicio`, `Reto`, `ConsultaIa`, `ConfiguracionSistema`, `LogAuditoria`. |
| **Usuarios** | `/admin/usuarios` | Pestañas por rol con su cantidad, filtros (activas, desactivadas, bloqueadas, con contraseña inicial) y búsqueda por nombre, correo, CI, RU o usuario `Nombre_CI`. Crear en **dos pasos** (rol con lo que puede hacer → datos, contraseña inicial generada y cambio obligatorio al entrar). Editar, restablecer contraseña (también desbloquea) y activar/desactivar. | Un usuario creado puede iniciar sesión en su rol; uno desactivado no. | Escribe `Usuario`; registra en `LogAuditoria`. |
| **Cursos y docentes** | `/admin/cursos` | Materias con sus paralelos: docente a cargo, estudiantes inscritos y solicitudes pendientes. **Asigna o cambia el docente** de cada paralelo y crea materias y paralelos. Lista de docentes con su carga. | Sin docente nadie acepta las solicitudes del paralelo. | Lee/escribe `Materia`, `Paralelo`; audita. |
| **Contenido** | `/admin/contenido` | Por unidad y tema: ejercicios de práctica en Básico, Intermedio y Avanzado, preguntas del examen y retos; marca lo que no llega a 10. | Lo completa el docente desde Unidades. | Lee `Unidad`, `Tema`, `Ejercicio`, `Reto`. |
| **Configuración** | `/admin/sistema` | Secciones **Institución**, **Reglas de avance**, **Puntos (XP)**, **Tutor PREXI (IA)**, **Alertas al docente** y **Evaluación e investigación**, cada opción explicada; los cambios se guardan o descartan juntos desde una barra fija. Incluye: fase de evaluación del sistema (SUS / ISO 25010), **rango objetivo** del motor adaptativo, **umbrales de los tres criterios de aceptación**, umbral de la evaluación final y umbrales de "en riesgo". | **TODO el sistema lee de aquí**, nada hardcodeado. | Lee/escribe `ConfiguracionSistema`; audita. |
| **Auditoría** | `/admin/auditoria` | Acciones importantes con nombre claro (cuentas, roles, cursos, configuración y seguridad), agrupadas por día; búsqueda libre, filtros por acción y fechas, y «cargar más». | Trazabilidad. | Lee `LogAuditoria`. |

> **Límites del admin:** nunca ve contraseñas (solo fuerza reseteo); **no** edita datos de
> medición (diagnóstico, evaluación final, intentos y logs son inmutables); no puede
> desactivarse ni quitarse su propio rol admin.

---

## 8. Flujo de la investigación

El estudio es **no experimental transversal**: un único grupo, sin manipular variables, y una
única medición al final del período de uso. Esquema `M: X → (O₁, O₂, O₃)`.

```
   ESTUDIANTE                               SISTEMA                         DOCENTE / EVALUADOR
       │                                       │                                    │
 1) rinde el DIAGNÓSTICO ──────────► θ inicial + nivel por tema                      │
    (pretest)                                  │                                    │
 2) practica: el motor asigna ─────► LogAdaptacion (una fila por decisión):          │
    ejercicios de SU nivel                     │  θ, b, P esperada, ¿en rango?,      │
                                               │  latencia y tiempo de respuesta     │
 3) retos, ranking, tutor ─────────► RetoUsuario · HistorialRanking · ConsultaIa     │
       │                                       │                                    │
       │        ── fin del período de uso: se habilita la FASE DE EVALUACIÓN ──      │
       │                                       │                                    │
 4) responde el SUS (una vez) ─────► RespuestaInstrumento ◄──── 5) responde ISO/IEC 25010
       │                                       │                                    │
       └───────────────────────────────────────┴──► 6) INVESTIGADOR: panel de validación
                                                     O₁ precisión · O₂ usabilidad · O₃ calidad
                                                     + CSV por instrumento ──► Python / SciPy
```

1. El **estudiante** rinde el **diagnóstico inicial** (pretest): se estima su habilidad θ y su nivel por tema.
2. Al practicar, el **motor adaptativo** le asigna ejercicios de su nivel; cada respuesta deja una fila en `LogAdaptacion`.
3. La **gamificación** (retos, ranking) y la retroalimentación quedan registradas en la base.
4. Al final del período, el docente o el admin **habilita la fase de evaluación**: cada estudiante responde el **SUS** una sola vez.
5. Los **docentes y evaluadores** responden el cuestionario **ISO/IEC 25010**.
6. El **investigador** ve los tres indicadores con su IC 95 % y la tabla de criterios, y **exporta** un CSV anonimizado por instrumento.

La **evaluación final del curso** (postest) la administra el docente y no forma parte del
contraste de la hipótesis. Detalle de cada fórmula: [DISENO_INVESTIGACION.md](DISENO_INVESTIGACION.md).

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
| POST | `/api/practica/ejecutar` · `/asistir` · GET/PUT `/practica/codigo` | Ejecutar código, PREXI, guardar código. |
| POST | `/api/tutor-ia/asistente` · `/pista` · `/practica` · `/retroalimentacion` | PREXI (sujeto a `iaActiva` y rate limit de la config). |
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
| POST | `/api/docente/revisiones/:retoId/:estudianteId/sugerir` | Borrador de feedback con PREXI. |
| GET/POST/PUT/DELETE | `/api/docente/documentos[...]` | Gestión de PDFs. |
| GET | `/api/docente/estudiantes` · `/:id` | Lista y detalle de seguimiento. |
| PUT | `/api/docente/estudiantes/:id/nota` | Guardar nota del docente. |
| GET | `/api/docente/reportes/pretest-postest` · `/progreso-niveles` · `/actividad-semanal` · `/export.csv` | Reportes + exportación. |

### Instrumentos de valoración (cualquier usuario autenticado)
| Método | Ruta | Función |
|---|---|---|
| GET | `/api/instrumentos/estado` | Qué cuestionario le toca al usuario y si ya lo respondió. |
| GET/POST | `/api/instrumentos/SUS` · `/api/instrumentos/ISO25010` | Ver y responder (una sola vez, con la fase habilitada). |
| POST | `/api/instrumentos/fase` | Habilitar o cerrar la fase de evaluación (docente/admin). |

### Investigador (`@Roles('investigador','admin')`)
| Método | Ruta | Función |
|---|---|---|
| GET | `/api/investigador/panel` | Resumen y avance del estudio. |
| GET | `/api/investigador/validacion` | **Indicadores de la tesis** y criterios de aceptación. |
| GET | `/api/investigador/validacion/log-adaptacion.csv` · `sus.csv` · `iso25010.csv` · `uso-gamificacion.csv` | Un CSV anonimizado por instrumento. |
| GET | `/api/investigador/validez` · `fiabilidad` · `clasificacion` · `ficha-metodologica` · `codebook` · `metadatos-corte` · `etica` | Participantes, instrumentos y reproducibilidad. |
| GET | `/api/investigador/exportacion/dataset` · `/export.csv` | Vista previa y **CSV anonimizado**. |

### Admin (`@Roles('admin')`)
| Método | Ruta | Función |
|---|---|---|
| GET | `/api/admin/dashboard` | Panel: avisos, números, estado de la IA y actividad. |
| GET/POST/PUT/PATCH | `/api/admin/usuarios[...]` | CRUD, estado y reset de contraseña. |
| GET/PUT | `/api/admin/config` | Leer/actualizar la configuración central. |
| GET | `/api/admin/auditoria` | Registro de acciones sensibles. |

---

## 10. Qué hace el sistema y qué se hace fuera

| Dentro del sistema (PREXI) | Fuera del sistema |
|---|---|
| Registra cada decisión del motor adaptativo (logs), los cambios de ranking y los retos. | El **análisis estadístico definitivo** (Python, Pandas, SciPy). |
| Aplica el SUS y el cuestionario ISO/IEC 25010, una vez por persona. | La **validación por expertos** de los instrumentos (V de Aiken). |
| Muestra los tres indicadores con su **IC 95 % por bootstrap** y la tabla de criterios. | La **decisión final** sobre la hipótesis y su redacción en la tesis. |
| **Exporta** un CSV anonimizado por instrumento, con su codebook. | La **interpretación** de los resultados. |

> **En una frase:** PREXI *registra, calcula y exporta* los indicadores que dicen si el
> sistema funciona bien; el análisis definitivo y la decisión sobre la hipótesis se hacen
> fuera, con los CSV, y se documentan en la tesis.

---

*Documento generado como mapa de referencia del sistema PREXI. Rutas y módulos verificados
contra el código en ejecución.*
