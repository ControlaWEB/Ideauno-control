# 02. Modelo de Negocio y Reglas - IDEA UNO OS

Este documento describe las entidades clave del negocio y las reglas operativas aplicadas en la plataforma **IDEA UNO OS**.

---

## 1. Mapeo de Entidades del Negocio

```
 ┌───────────────┐          ┌───────────────┐
 │   Propiedad   │ ◄─────── │   Operación   │ ───────► ┌───────────────┐
 │ (Inventario)  │          │ (Venta/Renta) │          │    Cliente    │
 └───────────────┘          └───────────────┘          └───────────────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │   Comisión    │
                            │ (Split/Pagos) │
                            └───────────────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │    Asesor     │ ◄─── Invitante (Mentor)
                            │  (Comercial)  │
                            └───────────────┘
```

---

## 2. Gestión de Asesores e Invitantes
La red de ventas de IDEA UNO OS opera bajo un esquema de mentoría y referidos:
1. **Asesor Principal:** Estatus `Activo`. Realiza operaciones comerciales directas.
2. **Asesor en Mentoría:** Estatus `Mentoría`. Requiere supervisión directa de un asesor patrocinador o invitante.
3. **Invitante (Mentor):** Asesor de mayor jerarquía que patrocinó a otro. Recibe un porcentaje de comisión por mentoría en las operaciones cerradas por su asesor patrocinado.
4. **Meta AMA:** Avance de la meta de productividad individual expresada en porcentaje (0% a 100%), calculada según el volumen de ventas acumuladas contra su cuota asignada.

---

## 3. Reglas de Cálculo de Comisiones
Las comisiones se derivan del `contract_value` (monto total del contrato de operación).

- **Comisión Total de Operación:** 
  $$\text{Comisión Total} = \text{Monto Contrato} \times \left(\frac{\text{Porcentaje de Comisión}}{100}\right)$$
  *Ejemplo:* Venta de $12,500,000.00 MXN al 5% genera una comisión de $625,000.00 MXN.

- **Split de Comisión (Reparto):**
  - **Comisión Directa (Asesor Cerrador):** 80% del valor total de la comisión.
  - **Comisión por Mentoría (Invitante/Patrocinador):** 20% del valor total de la comisión.
  - *Nota:* Si la operación no tiene un invitante asignado (Directo), el 100% de la comisión se calcula para el Asesor Cerrador.

---

## 4. Cumplimiento Normativo PLD / KYC (Prevención de Lavado de Dinero)
Para cumplir con la legislación mexicana (**LFPIORPI** - Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita):

1. **Umbral de Identificación y Aviso:**
   - Para operaciones inmobiliarias, el umbral de aviso ante el SAT se establece en **$941,412.75 MXN** (ajustable en la configuración del sistema).
   - Cualquier operación que supere o sea igual a este monto se cataloga automáticamente como **Operación Vulnerable** y entra en la categoría **Ámbar** o **Rojo** en el semáforo PLD.

2. **Expediente Único de Clientes (KYC):**
   Para aprobar el pago de comisiones de una operación vulnerable, el cliente (comprador/arrendatario) debe tener el expediente KYC completo:
   - Identificación Oficial Validada.
   - RFC / Cédula Fiscal Validada.
   - Declaración de no ser PEP (Persona Políticamente Expuesta) o estado PEP verificado.
   
3. **Bloqueo de Comisión:**
   Si una operación supera el umbral y carece de documentación o presenta alerta de PEP (Persona Políticamente Expuesta), el estatus del expediente de cumplimiento pasa a `BLOQUEADO` y la comisión se congela (`comisiones_bloqueadas`).
