-- ============================================================================
-- migration_v9.sql — Rollover automático del periodo AMA (cada 365 días)
-- ----------------------------------------------------------------------------
-- Idea Uno confirmó que la meta AMA se reinicia cada 365 días. Antes de esta
-- migración, fact_ama_asesor.fecha_fin_periodo nunca se actualizaba solo: si
-- un asesor no tenía comisiones nuevas justo al vencer su periodo, el sistema
-- se quedaba con el periodo viejo indefinidamente (dashboard, "Mi Dashboard"
-- y el motor de comisiones podían usar una ventana de fechas ya vencida).
--
-- rollover_ama_periods() cierra (estatus_ama = 'Reiniciado') cualquier fila
-- vigente cuyo fecha_fin_periodo ya pasó, y abre una fila nueva "En progreso"
-- arrancando en el punto correcto: si pasaron varios ciclos de 365 días sin
-- actividad, salta directo al ciclo que contiene hoy (no crea filas vacías
-- intermedias). meta_ama de la fila nueva se toma del valor VIVO de config.
-- Es idempotente: se puede llamar en cada lectura/escritura de AMA sin costo
-- relevante (si no hay nada vencido, no hace nada).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rollover_ama_periods() RETURNS void AS $$
DECLARE
  rec RECORD;
  meta_actual NUMERIC;
  ciclos INT;
  nuevo_inicio DATE;
  nuevo_fin DATE;
  nuevo_id TEXT;
BEGIN
  SELECT valor_numerico INTO meta_actual
  FROM public.config_parametros_comision
  WHERE nombre_parametro = 'meta_ama' AND activo = true
  LIMIT 1;

  FOR rec IN
    SELECT f.id, f.id_asesor, f.fecha_fin_periodo
    FROM public.fact_ama_asesor f
    JOIN public.advisors a ON a.id = f.id_asesor
    WHERE f.estatus_ama <> 'Reiniciado'
      AND f.fecha_fin_periodo IS NOT NULL
      AND f.fecha_fin_periodo <= CURRENT_DATE
      AND a.status IN ('Activo', 'En mentoría')
  LOOP
    UPDATE public.fact_ama_asesor
    SET estatus_ama = 'Reiniciado', updated_at = now()
    WHERE id = rec.id;

    -- Salta directo al ciclo de 365 días que contiene la fecha de hoy,
    -- sin crear filas intermedias vacías si pasaron varios ciclos sin actividad.
    ciclos := FLOOR((CURRENT_DATE - rec.fecha_fin_periodo) / 365.0);
    nuevo_inicio := rec.fecha_fin_periodo + (ciclos * INTERVAL '365 days');
    nuevo_fin := nuevo_inicio + INTERVAL '365 days';
    nuevo_id := 'ama-' || substr(md5(random()::text), 1, 8);

    INSERT INTO public.fact_ama_asesor
      (id, id_asesor, fecha_inicio_periodo, fecha_fin_periodo, meta_ama,
       monto_acumulado, avance_pct, ama_alcanzada, estatus_ama)
    VALUES
      (nuevo_id, rec.id_asesor, nuevo_inicio::date, nuevo_fin::date,
       COALESCE(meta_actual, 0), 0, 0, false, 'En progreso');
  END LOOP;
END;
$$ LANGUAGE plpgsql;
