# 07. Plan de Trabajo y Roadmap - IDEA UNO OS

Este documento presenta las etapas de desarrollo, hitos de entrega y criterios de aceptación para la implementación de **IDEA UNO OS**.

---

## 1. Cronograma de Desarrollo

```
Fase 1: Cimientos y Docs ───> Fase 2: Backend Core ───> Fase 3: Dashboard/Reportes ───> Fase 4: Frontend Next.js 15 ───> Fase 5: QA y Docker
     [Completado]                 [Día 2-4]                [Día 5]                   [Día 6-8]                    [Día 9]
```

---

## 2. Detalle de Hitos (Milestones)

### Hito 1: Cimientos y Documentación (Fase 1)
- **Entregable:** Repositorio estructurado y manuales de arquitectura en `docs/`.
- **Criterio de Aceptación:** Estructuras de carpetas `/backend` y `/frontend` creadas.

### Hito 2: API Backend y Adaptador de Datos (Fase 2)
- **Entregable:** NestJS Backend conectado a Supabase (PostgreSQL).
- **Criterio de Aceptación:**
  - `DatabaseService` ejecutando consultas parametrizadas contra Supabase.
  - CRUD de propiedades y operaciones operativo.
  - Endpoints de autenticación JWT y guardia de roles activos.

### Hito 3: Business Logic y Reportes (Fase 3)
- **Entregable:** Módulo de comisiones automatizado y descargas de reportes.
- **Criterio de Aceptación:**
  - Cálculo automático del 80/20 en comisiones.
  - Bloqueo automático de comisiones si se supera el umbral PLD sin expediente KYC.
  - Descarga de archivos CSV en operaciones y propiedades.

### Hito 4: Interfaz de Usuario Corporativa (Fase 4)
- **Entregable:** Frontend responsivo Next.js 15 implementando el diseño visual de los prototipos.
- **Criterio de Aceptación:**
  - Panel lateral fijo con estados activos consistentes con `DESIGN.md`.
  - Página de inicio con KPI Bento Grid, alertas en color rojo para bloqueos, y semáforo PLD.
  - Integración completa con Zustand y TanStack Query.

### Hito 5: Despliegue Docker (Fase 5)
- **Entregable:** docker-compose y Dockerfiles funcionales.
- **Criterio de Aceptación:**
  - Al ejecutar `docker-compose up --build` ambos servicios levantan y se comunican sin errores de CORS o red.

---

## 3. Estrategia de Migración de Datos (Puesta en Marcha)

Supabase usa PostgreSQL estándar con soporte completo de migraciones SQL:
1. **Inicialización:** Ejecutar el DDL de `docs/03-database-schema.md` en el SQL Editor de Supabase para crear todas las tablas.
2. **Carga de Datos de Referencia:** Script semilla (`seed`) para precargar usuarios (Super Admin de prueba), propiedades y asesores simulados para demostración inicial.
