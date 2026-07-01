# 06. Motor de Comisiones — IDEA UNO OS

---

## 1. Dónde vive el motor

**Decisión: PostgreSQL function + trigger en NestJS como capa de orquestación.**

- La función de cálculo vive en NestJS (TypeScript) para ser testeable y legible.
- Al validar un cierre, NestJS llama la función, calcula, e inserta en `fact_comisiones`.
- PostgreSQL trigger llena `audit_log` en cada INSERT/UPDATE de `fact_comisiones` y `fact_pagos`.
- PostgreSQL trigger actualiza `fact_ama_asesor` después de cada INSERT en `fact_comisiones`.

**Por qué no Edge Functions:** latencia innecesaria; el cálculo ya está en el contexto de un request NestJS que tiene todos los datos.

---

## 2. Parámetros de cálculo

Todos vienen de `config_parametros_comision`. **Nunca hardcodear porcentajes.**

```typescript
const params = await getParamsActivos(); // Lee config_parametros_comision WHERE activo = TRUE
const PCT_INVITACION = params.porcentaje_invitacion;         // 0.025
const PCT_ASESOR_NORMAL = params.porcentaje_asesor_normal;   // 0.80
const PCT_MENTORIA = params.porcentaje_mentoria;             // 0.05
const MIN_RENTA_MENTORIA = params.minimo_exento_mentoria_renta; // 5000
```

---

## 3. Orden de cálculo — Caso estándar

```
monto_comision_total
        │
        ▼
[¿Tiene invitador?]
  SÍ → monto_invitacion = total * PCT_INVITACION
  NO → monto_invitacion = 0
        │
        ▼
monto_remanente = total - monto_invitacion
        │
        ▼
[¿AMA alcanzada en período activo?]
  SÍ → porcentaje_asesor = 1.0   monto_base_asesor = remanente   monto_inmobiliaria = 0
  NO → porcentaje_asesor = PCT_ASESOR_NORMAL
       monto_base_asesor = remanente * PCT_ASESOR_NORMAL
       monto_inmobiliaria = remanente - monto_base_asesor
        │
        ▼
[¿Aplica mentoría?]
  Condiciones para SÍ:
    - pasa_por_mentoria = TRUE en dim_asesores
    - tipo_operacion = Renta → monto_comision_total >= MIN_RENTA_MENTORIA
    - tipo_operacion = Venta → siempre aplica
  SÍ → monto_mentoria = monto_base_asesor * PCT_MENTORIA
  NO → monto_mentoria = 0
        │
        ▼
monto_neto_asesor = monto_base_asesor - monto_mentoria
```

---

## 4. Fórmula en pseudocódigo TypeScript

```typescript
function calcularComision(input: ComisionInput): ComisionResult {
  const {
    monto_comision_total,
    tipo_operacion,
    id_asesor_cerrador,
    asesor,         // dim_asesores row
    periodoAma,     // fact_ama_asesor row activo
    params,         // config_parametros_comision
  } = input;

  // Paso 1: Gratificación por invitación
  const tiene_invitador = !!asesor.id_asesor_invitador;
  const monto_invitacion = tiene_invitador
    ? monto_comision_total * params.porcentaje_invitacion
    : 0;

  // Paso 2: Remanente
  const monto_remanente = monto_comision_total - monto_invitacion;

  // Paso 3: Split asesor / inmobiliaria según AMA
  const ama_alcanzada = periodoAma?.ama_alcanzada ?? false;
  const porcentaje_asesor = ama_alcanzada ? 1.0 : params.porcentaje_asesor_normal;
  const monto_base_asesor = monto_remanente * porcentaje_asesor;
  const monto_inmobiliaria = monto_remanente - monto_base_asesor;

  // Paso 4: Mentoría
  const en_mentoria = asesor.pasa_por_mentoria;
  const exento_por_monto =
    tipo_operacion === 'Renta' && monto_comision_total < params.minimo_exento_mentoria_renta;
  const aplica_mentoria = en_mentoria && !exento_por_monto;
  const monto_mentoria = aplica_mentoria
    ? monto_base_asesor * params.porcentaje_mentoria
    : 0;

  // Paso 5: Neto asesor
  const monto_neto_asesor = monto_base_asesor - monto_mentoria;

  return {
    monto_comision_total,
    monto_invitacion,
    id_asesor_invitador: asesor.id_asesor_invitador ?? null,
    monto_remanente,
    aplica_ama: ama_alcanzada,
    porcentaje_asesor,
    monto_base_asesor,
    aplica_mentoria,
    porcentaje_mentoria: aplica_mentoria ? params.porcentaje_mentoria : 0,
    monto_mentoria,
    id_mentor: aplica_mentoria ? asesor.id_mentor : null,
    monto_neto_asesor,
    monto_inmobiliaria,
    estatus_comision: 'Calculada',
  };
}
```

---

## 5. Caso: Dos asesores Idea Uno en la misma operación

Cuando vendedor y comprador son representados por **diferentes asesores internos**:

### Regla

- Cada asesor genera su **propio registro** en `fact_comisiones`.
- La comisión total se divide según el `porcentaje_participacion` registrado en `bridge_operacion_asesores`.
- El 2.5% de invitación se aplica **por separado** a la porción de cada asesor.
- La gratificación al invitador de cada asesor corresponde al invitador de **ese asesor específico**, no del otro.

### Ejemplo

```
Venta $12,500,000 MXN — comisión total $625,000 (5%)
Asesor A (lado vendedor) 50% → $312,500
Asesor B (lado comprador) 50% → $312,500

Cálculo Asesor A (tiene invitador, sin AMA, en mentoría):
  invitación = $312,500 * 2.5% = $7,812.50
  remanente = $304,687.50
  base asesor = $304,687.50 * 80% = $243,750
  mentoría = $243,750 * 5% = $12,187.50
  neto asesor A = $231,562.50

Cálculo Asesor B (sin invitador, con AMA):
  invitación = $0
  remanente = $312,500
  base asesor = $312,500 (100% por AMA)
  mentoría = no aplica
  neto asesor B = $312,500
```

### Implementación

```typescript
// En fact_cierres: id_asesor_cerrador = asesor principal (quien registra el cierre)
// En bridge_operacion_asesores: ambos asesores con porcentaje_participacion

// Motor corre una vez por cada asesor interno en bridge_operacion_asesores
const participantes = await getAsesoresInternosOperacion(id_operacion);
for (const participante of participantes) {
  const monto_porcion = monto_comision_total * participante.porcentaje_participacion;
  const result = calcularComision({ ...input, monto_comision_total: monto_porcion, asesor: participante.asesor });
  await insertarComision({ ...result, id_operacion });
}
```

---

## 6. Cuándo se dispara el motor

| Evento | Acción |
|---|---|
| Admin valida un cierre (`estatus_cierre → Validado por administración`) | Motor calcula y crea `fact_comisiones` con `estatus = Calculada` |
| Expediente PLD completo + cierre validado | `estatus_comision → Liberada` |
| Asesor solicita pago | Crea `fact_pagos` con `estatus = Solicitado` |
| Admin autoriza pago | `estatus_pago → Autorizado` |
| Pago ejecutado | `estatus_pago → Pagado`, `estatus_comision → Pagada` |
| Cierre cancelado | `estatus_comision → Cancelada`, `fact_pagos` pendientes → `Cancelado` |

---

## 7. Actualización de AMA

Trigger PostgreSQL después de INSERT en `fact_comisiones`:

```sql
CREATE OR REPLACE FUNCTION actualizar_ama()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE fact_ama_asesor
  SET
    monto_acumulado = monto_acumulado + NEW.monto_neto_asesor,
    avance_pct = LEAST(
      ((monto_acumulado + NEW.monto_neto_asesor) / meta_ama) * 100,
      100
    ),
    ama_alcanzada = (monto_acumulado + NEW.monto_neto_asesor) >= meta_ama,
    fecha_ama_alcanzada = CASE
      WHEN (monto_acumulado + NEW.monto_neto_asesor) >= meta_ama
           AND ama_alcanzada = FALSE
      THEN NOW()
      ELSE fecha_ama_alcanzada
    END,
    estatus_ama = CASE
      WHEN (monto_acumulado + NEW.monto_neto_asesor) >= meta_ama THEN 'AMA alcanzada'
      WHEN ((monto_acumulado + NEW.monto_neto_asesor) / meta_ama) >= 0.8 THEN '80% alcanzado'
      ELSE 'En progreso'
    END,
    updated_at = NOW()
  WHERE id_asesor = NEW.id_asesor_cerrador
    AND fecha_inicio_periodo <= CURRENT_DATE
    AND fecha_fin_periodo >= CURRENT_DATE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_ama
AFTER INSERT ON fact_comisiones
FOR EACH ROW EXECUTE FUNCTION actualizar_ama();
```

---

## 8. Triggers de auditoría

```sql
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    tabla_afectada, id_registro, accion,
    valor_anterior, valor_nuevo, fecha_evento
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id_operacion, NEW.id_comision, NEW.id_pago, OLD.id_operacion, OLD.id_comision, OLD.id_pago),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tablas críticas
CREATE TRIGGER audit_fact_cierres
AFTER INSERT OR UPDATE OR DELETE ON fact_cierres
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_fact_comisiones
AFTER INSERT OR UPDATE OR DELETE ON fact_comisiones
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_fact_pagos
AFTER INSERT OR UPDATE OR DELETE ON fact_pagos
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_config_parametros
AFTER INSERT OR UPDATE OR DELETE ON config_parametros_comision
FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## 9. Bloqueos automáticos

El sistema debe bloquear (`estatus_comision → Bloqueada`) automáticamente si:

```typescript
function evaluarBloqueo(cierre: FactCierre, expediente: ExpedienteCheck): BloqueoResult {
  const razones: string[] = [];

  if (!cierre.pld_expediente_completo) {
    razones.push('Expediente PLD incompleto');
  }

  if (cierre.umbral_pld_superado && expediente.estatus_kyc !== 'Validado') {
    razones.push('Operación vulnerable: KYC no validado');
  }

  if (expediente.es_pep && !expediente.pep_verificado) {
    razones.push('Cliente PEP sin verificación');
  }

  if (!documentosObligatoriosCompletos(cierre.id_operacion)) {
    razones.push('Documentos obligatorios faltantes');
  }

  return { bloqueado: razones.length > 0, razones };
}
```

---

## 10. Discrepancia con doc 02-modelo-negocio.md

El documento `02-modelo-negocio.md` dice: *80% cerrador / 20% mentor*.
El documento de estructura del proyecto dice: *2.5% invitación + 80% del remanente + 5% mentoría*.

**Son esquemas diferentes.** Este motor implementa el esquema detallado del documento de estructura (el más reciente y granular). Confirmar con cliente cuál aplica antes de desarrollar.
