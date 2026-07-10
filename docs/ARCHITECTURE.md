# Arquitectura de PREXI UPEA

Documento breve de arquitectura para el mantenimiento del sistema y como respaldo
de la tesis. Describe **cómo** está organizado el código, **por qué** (decisiones
clave) y **dónde** vive cada responsabilidad.

## 1. Visión general

PREXI es una plataforma web para aprender **Python** (primer semestre, Ingeniería
de Sistemas, UPEA) que combina tres ideas:

1. **Adaptatividad determinística** — un **motor de reglas** decide el nivel del
   estudiante, el orden de los ejercicios y el desbloqueo de niveles/temas. Es
   **predecible y auditable** (requisito para la validez del estudio).
2. **IA de apoyo (ALVARO, sobre Google Gemini)** — explica, guía y acompaña con
   lenguaje natural personalizado. **Nunca** decide calificación, adaptatividad
   ni desbloqueo.
3. **Gamificación** — XP, rachas, emblemas y rangos, todos derivados del
   desempeño real calculado en el backend.

El sistema soporta **4 roles**: estudiante, docente, investigador y admin.

## 2. Separación backend / frontend

Dos aplicaciones independientes, desplegables por separado:

| | Tecnología | Responsabilidad |
|---|---|---|
| [`backend/`](backend) | NestJS + Prisma + PostgreSQL | **Toda** la lógica de negocio, seguridad y persistencia |
| [`frontend/`](frontend) | Next.js 14 (App Router) + Tailwind | **Solo** presentación e interacción; no calcula reglas |

El frontend habla con el backend por `/api` (proxy de Next → NestJS), de modo que
la **cookie httpOnly** del JWT viaja sin exponer el token a JavaScript.

> **Regla de oro:** toda decisión con consecuencia (corrección de respuestas, XP,
> desbloqueo, ranking, rangos) se calcula en el **backend**. El frontend nunca es
> fuente de verdad.

## 3. Screaming Architecture (organización por dominio)

El backend se organiza **por dominio de negocio**, no por capas técnicas: la
estructura de carpetas "grita" lo que el sistema hace. Cada dominio agrupa su
`controller`, `service`, `dto/` y pruebas.

```
backend/src/
  auth/                  Registro, login, JWT, recuperación de contraseña
  pretest/  postest/     Evaluaciones diagnósticas (datos de la investigación)
  ejercicios/            Corrección, XP, desbloqueo y ruta ADAPTATIVA (motor de reglas)
  practica/              Zona de práctica + ejecución en Piston (sandbox)
  tutor-ia/              ALVARO (Gemini): asistente, pistas, retro, RAG del PDF
  gamificacion/          Emblemas y rangos (derivados del desempeño real)
  ranking/  progreso/    Ranking global y progreso por nivel/tema
  retos/  documentos/    Retos del docente y material (PDF)
  unidades/              Jerarquía académica Unidad → Tema → Subtema
  notificaciones/        Campana del estudiante
  docente-*/             7 dominios del rol docente (dashboard, ejercicios, revisiones…)
  investigador-*/        4 dominios del rol investigador (solo lectura + export CSV)
  admin-*/               5 dominios del rol admin (usuarios, grupos, config, auditoría)
  common/                Transversal: prisma, guards de auth/rol, mail, pdf, filtros
```

Cada dominio es un `Module` de NestJS registrado en [`app.module.ts`](backend/src/app.module.ts).
Lo transversal (no de un dominio) vive en [`common/`](backend/src/common).

## 4. El motor de reglas (adaptatividad) vs. la IA

Esta separación es la decisión arquitectónica central y conviene documentarla con
precisión para la tesis.

### Determinístico (motor de reglas) — sin IA
- **Nivel inicial**: se deriva del puntaje del pretest por umbrales.
- **Corrección y XP**: [`ejercicios/correccion.ts`](backend/src/ejercicios/correccion.ts)
  y [`ejercicios/ejercicios.service.ts`](backend/src/ejercicios/ejercicios.service.ts)
  (XP base − penalización por pistas × multiplicador de racha).
- **Orden adaptativo de la ruta**: [`ejercicios/adaptatividad.service.ts`](backend/src/ejercicios/adaptatividad.service.ts)
  ajusta la dificultad objetivo con aciertos/fallos (sube con racha, baja con error).
- **Desbloqueo de niveles/temas**: por umbral de ejercicios correctos.
- **Fortalezas/debilidades, rangos, emblemas**: cálculo por % de aciertos y
  desempeño en [`gamificacion/`](backend/src/gamificacion).
- **Mensajes de progreso**: plantillas con datos reales, no IA.

### IA de apoyo (ALVARO / Gemini) — solo lenguaje explicativo
Vive **solo** en tres dominios: [`tutor-ia/`](backend/src/tutor-ia),
`docente-preguntas-ia/` y `docente-revisiones/`. Se usa donde el valor real es
generar texto personalizado que una regla fija no puede replicar:
- Asistente de dudas, retroalimentación tras error, pistas escalonadas y
  asistencia sobre el código del estudiante.
- Generación **asistida** de preguntas desde un PDF (siempre borrador; el docente
  revisa y aprueba) y borrador de feedback para el docente.

**Optimización de costos** (producción): la retroalimentación muestra primero la
explicación estática del docente (`Ejercicio.explicacionIa`) y solo llama a Gemini
si el estudiante lo pide; las llamadas usan la variante **Flash**, tope de tokens
de salida por tipo, caché por-usuario de preguntas repetidas y rate-limit por hora.
La `GEMINI_API_KEY` vive **solo** en el backend.

## 5. Seguridad

- Contraseñas con **bcrypt**; bloqueo de cuenta tras 5 intentos fallidos.
- **JWT en cookie httpOnly** (`secure` en producción, `SameSite=Lax`).
- **Guards** de autenticación y de rol ([`common/auth/`](backend/src/common/auth))
  en todas las rutas protegidas; validación global de DTOs (`whitelist +
  forbidNonWhitelisted`).
- **Recuperación de contraseña**: token aleatorio de un solo uso con expiración
  corta; en la BD se guarda solo su **hash sha256** (nunca el token en claro);
  respuesta genérica que no revela si el correo existe; rate-limit de la solicitud.
- El **código del estudiante nunca se ejecuta en el backend**: va al contenedor
  **Piston** aislado (límites de tiempo/memoria).
- Errores no controlados: log interno completo, **sin stack traces al cliente**
  ([`common/filters/http-exception.filter.ts`](backend/src/common/filters/http-exception.filter.ts)).

## 6. Configuración central

La fila única `ConfiguracionSistema` (id = 1) es la **única fuente** de parámetros
operativos (XP, umbrales, modelo de IA, rate-limit, detección de riesgo…). El
estudiante, el docente y la IA leen de ahí; **solo el admin** la edita. Nada de
esos parámetros está "hardcodeado".

## 7. Datos para la investigación

`Evaluacion` (pretest/postest) es la **fuente de verdad** del puntaje: un test
completado se lee de la evaluación persistida, no se recomputa. El investigador
exporta un dataset canónico (CSV anonimizado) con `puntaje_pretest`,
`puntaje_postest`, `ganancia`, `tiempo` y `grupo` (control/experimental) para la
prueba t de Student, que se realiza fuera del sistema.

## 8. Persistencia

Prisma + PostgreSQL. El esquema, con sus modelos y relaciones documentados, está
en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). El acceso pasa
siempre por `PrismaService` ([`common/prisma/`](backend/src/common/prisma)).
