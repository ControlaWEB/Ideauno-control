import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const VALID_STATUSES = [
  'Pendiente',
  'En elaboración',
  'Requiere información',
  'Entregado',
  'Cancelado',
];

@Injectable()
export class ContractsService {
  constructor(private databaseService: DatabaseService) {}

  async create(dto: Record<string, any>) {
    const id = 'cont-' + Math.random().toString(36).substring(2, 10);

    await this.databaseService.query(
      `INSERT INTO public.fact_solicitudes_contrato (
         id, tipo_solicitud, id_propiedad, id_asesor_solicitante,
         precio_renta_acordada, fecha_firma_estimada, fecha_entrega_estimada,
         condiciones_pago, observaciones_asesor, confirmacion_asesor,
         rep_vendedor_tipo, asesor_interno_vendedor, nombre_externo_vendedor,
         telefono_externo_vendedor, correo_externo_vendedor, inmobiliaria_externa_vendedor,
         rep_comprador_tipo, asesor_interno_comprador, nombre_externo_comprador,
         telefono_externo_comprador, correo_externo_comprador, inmobiliaria_externa_comprador,
         comision_pactada_pct, comision_pactada_monto, existe_comision_compartida,
         detalle_comision_compartida, precio_final_acordado,
         docs_vendedor_completos, docs_vendedor_faltantes,
         docs_comprador_completos, docs_comprador_faltantes,
         requiere_aval, tipo_aval, nombre_aval, telefono_aval, correo_aval,
         cliente_tipo, cliente_nombre, cliente_telefono, cliente_correo,
         cliente_estado_civil, cliente_regimen_patrimonial, cliente_nombre_conyuge,
         fecha_inicio_contrato, fecha_entrega_inmueble, vigencia,
         deposito_garantia, primer_pago_renta, forma_pago_renta,
         dia_pago_mensual, incluye_mantenimiento, servicios_incluidos,
         permite_mascotas, entrega_amueblado, observaciones_acuerdos,
         observaciones_juridico, condiciones_especiales, formas_pago,
         monto_apartado, fecha_estimada_escritura,
         estatus_solicitud, fecha_solicitud
       ) VALUES (
         @id, @tipoSolicitud, @idPropiedad, @idAsesorSolicitante,
         @precioRenta, @fechaFirma, @fechaEntrega,
         @condicionesPago, @observacionesAsesor, @confirmacionAsesor,
         @repVendedorTipo, @asesorInternoVendedor, @nombreExternoVendedor,
         @telefonoExternoVendedor, @correoExternoVendedor, @inmobiliariaExternaVendedor,
         @repCompradorTipo, @asesorInternoComprador, @nombreExternoComprador,
         @telefonoExternoComprador, @correoExternoComprador, @inmobiliariaExternaComprador,
         @comisionPactadaPct, @comisionPactadaMonto, @existeComisionCompartida,
         @detalleComisionCompartida, @precioFinalAcordado,
         @docsVendedorCompletos, @docsVendedorFaltantes,
         @docsCompradorCompletos, @docsCompradorFaltantes,
         @requiereAval, @tipoAval, @nombreAval, @telefonoAval, @correoAval,
         @clienteTipo, @clienteNombre, @clienteTelefono, @clienteCorreo,
         @clienteEstadoCivil, @clienteRegimenPatrimonial, @clienteNombreConyuge,
         @fechaInicioContrato, @fechaEntregaInmueble, @vigencia,
         @depositoGarantia, @primerPagoRenta, @formaPagoRenta,
         @diaPagoMensual, @incluyeMantenimiento, @serviciosIncluidos,
         @permiteMascotas, @entregaAmueblado, @observacionesAcuerdos,
         @observacionesJuridico, @condicionesEspeciales, @formasPago,
         @montoApartado, @fechaEstimadaEscritura,
         'Pendiente', NOW()
       )`,
      {
        id,
        tipoSolicitud: dto.tipo_solicitud ?? dto.tipoSolicitud ?? '',
        idPropiedad: dto.id_propiedad ?? dto.idPropiedad ?? '',
        idAsesorSolicitante:
          dto.id_asesor_solicitante ?? dto.idAsesorSolicitante ?? '',
        precioRenta:
          dto.precio_renta_acordada ?? dto.precioRentaAcordada ?? null,
        // El formulario envía fecha_estimada_firma; la columna es fecha_firma_estimada
        fechaFirma:
          dto.fecha_firma_estimada ??
          dto.fecha_estimada_firma ??
          dto.fechaFirmaEstimada ??
          null,
        fechaEntrega:
          dto.fecha_entrega_estimada ?? dto.fechaEntregaEstimada ?? null,
        condicionesPago: dto.condiciones_pago ?? dto.condicionesPago ?? '',
        observacionesAsesor:
          dto.observaciones_asesor ?? dto.observacionesAsesor ?? '',
        confirmacionAsesor:
          (dto.confirmacion_asesor ?? dto.confirmacionAsesor)
            ? 'true'
            : 'false',
        repVendedorTipo: dto.rep_vendedor_tipo ?? dto.repVendedorTipo ?? '',
        asesorInternoVendedor:
          dto.asesor_interno_vendedor ?? dto.asesorInternoVendedor ?? '',
        nombreExternoVendedor:
          dto.nombre_externo_vendedor ?? dto.nombreExternoVendedor ?? '',
        telefonoExternoVendedor:
          dto.telefono_externo_vendedor ?? dto.telefonoExternoVendedor ?? '',
        correoExternoVendedor:
          dto.correo_externo_vendedor ?? dto.correoExternoVendedor ?? '',
        inmobiliariaExternaVendedor:
          dto.inmobiliaria_externa_vendedor ??
          dto.inmobiliariaExternaVendedor ??
          '',
        repCompradorTipo: dto.rep_comprador_tipo ?? dto.repCompradorTipo ?? '',
        asesorInternoComprador:
          dto.asesor_interno_comprador ?? dto.asesorInternoComprador ?? '',
        nombreExternoComprador:
          dto.nombre_externo_comprador ?? dto.nombreExternoComprador ?? '',
        telefonoExternoComprador:
          dto.telefono_externo_comprador ?? dto.telefonoExternoComprador ?? '',
        correoExternoComprador:
          dto.correo_externo_comprador ?? dto.correoExternoComprador ?? '',
        inmobiliariaExternaComprador:
          dto.inmobiliaria_externa_comprador ??
          dto.inmobiliariaExternaComprador ??
          '',
        comisionPactadaPct:
          dto.comision_pactada_pct ?? dto.comisionPactadaPct ?? 0,
        comisionPactadaMonto:
          dto.comision_pactada_monto ?? dto.comisionPactadaMonto ?? 0,
        existeComisionCompartida:
          (dto.existe_comision_compartida ?? dto.existeComisionCompartida)
            ? 'true'
            : 'false',
        detalleComisionCompartida:
          dto.detalle_comision_compartida ??
          dto.detalleComisionCompartida ??
          '',
        precioFinalAcordado:
          dto.precio_final_acordado ?? dto.precioFinalAcordado ?? 0,
        docsVendedorCompletos:
          dto.docs_vendedor_completos ?? dto.docsVendedorCompletos ?? 'no',
        docsVendedorFaltantes:
          dto.docs_vendedor_faltantes ?? dto.docsVendedorFaltantes ?? '',
        docsCompradorCompletos:
          dto.docs_comprador_completos ?? dto.docsCompradorCompletos ?? 'no',
        docsCompradorFaltantes:
          dto.docs_comprador_faltantes ?? dto.docsCompradorFaltantes ?? '',
        requiereAval:
          (dto.requiere_aval ?? dto.requiereAval) ? 'true' : 'false',
        tipoAval: dto.tipo_aval ?? dto.tipoAval ?? '',
        nombreAval: dto.nombre_aval ?? dto.nombreAval ?? '',
        telefonoAval: dto.telefono_aval ?? dto.telefonoAval ?? '',
        correoAval: dto.correo_aval ?? dto.correoAval ?? '',
        // Cliente (comprador / arrendatario)
        clienteTipo: dto.cliente_tipo ?? dto.clienteTipo ?? 'Persona física',
        clienteNombre: dto.cliente_nombre ?? dto.clienteNombre ?? '',
        clienteTelefono: dto.cliente_telefono ?? dto.clienteTelefono ?? '',
        clienteCorreo: dto.cliente_correo ?? dto.clienteCorreo ?? '',
        clienteEstadoCivil:
          dto.cliente_estado_civil ?? dto.clienteEstadoCivil ?? '',
        clienteRegimenPatrimonial:
          dto.cliente_regimen_patrimonial ??
          dto.clienteRegimenPatrimonial ??
          '',
        clienteNombreConyuge:
          dto.cliente_nombre_conyuge ?? dto.clienteNombreConyuge ?? '',
        // Arrendamiento
        fechaInicioContrato:
          dto.fecha_inicio_contrato ?? dto.fechaInicioContrato ?? null,
        fechaEntregaInmueble:
          dto.fecha_entrega_inmueble ?? dto.fechaEntregaInmueble ?? null,
        vigencia: dto.vigencia ?? '',
        depositoGarantia: dto.deposito_garantia ?? dto.depositoGarantia ?? null,
        primerPagoRenta: dto.primer_pago_renta ?? dto.primerPagoRenta ?? null,
        formaPagoRenta: dto.forma_pago_renta ?? dto.formaPagoRenta ?? '',
        diaPagoMensual: dto.dia_pago_mensual ?? dto.diaPagoMensual ?? null,
        incluyeMantenimiento:
          (dto.incluye_mantenimiento ?? dto.incluyeMantenimiento)
            ? 'true'
            : 'false',
        serviciosIncluidos:
          dto.servicios_incluidos ?? dto.serviciosIncluidos ?? '',
        permiteMascotas:
          (dto.permite_mascotas ?? dto.permiteMascotas) ? 'true' : 'false',
        entregaAmueblado:
          (dto.entrega_amueblado ?? dto.entregaAmueblado) ? 'true' : 'false',
        observacionesAcuerdos:
          dto.observaciones_acuerdos ?? dto.observacionesAcuerdos ?? '',
        observacionesJuridico: dto.observaciones_juridico ?? '',
        condicionesEspeciales: dto.condiciones_especiales ?? '',
        formasPago: dto.formas_pago ?? '',
        montoApartado: dto.monto_apartado ?? null,
        fechaEstimadaEscritura: dto.fecha_estimada_escritura ?? null,
      },
    );

    // Insert buyer/tenant into dim_clientes if provided
    const clienteData = dto.cliente ?? dto.clienteData;
    if (clienteData && typeof clienteData === 'object') {
      const clienteId =
        clienteData.id ?? 'cli-' + Math.random().toString(36).substring(2, 10);
      await this.databaseService.query(
        `INSERT INTO public.dim_clientes (
           id, tipo_cliente, nombre_razon_social, persona_tipo, telefono,
           correo, estado_civil, regimen_patrimonial
         ) VALUES (
           @id, @tipoCliente, @nombreRazonSocial, @personaTipo, @telefono,
           @correo, @estadoCivil, @regimenPatrimonial
         )`,
        {
          id: clienteId,
          tipoCliente:
            clienteData.tipo_cliente ?? clienteData.tipoCliente ?? '',
          nombreRazonSocial:
            clienteData.nombre_razon_social ??
            clienteData.nombreRazonSocial ??
            '',
          personaTipo:
            clienteData.persona_tipo ?? clienteData.personaTipo ?? '',
          telefono: clienteData.telefono ?? '',
          correo: clienteData.correo ?? '',
          estadoCivil:
            clienteData.estado_civil ?? clienteData.estadoCivil ?? '',
          regimenPatrimonial:
            clienteData.regimen_patrimonial ??
            clienteData.regimenPatrimonial ??
            '',
        },
      );
    }

    return { id, estatus_solicitud: 'Pendiente' };
  }

  async findAll(filters: {
    advisorId?: string;
    tipoSolicitud?: string;
    estatus?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.advisorId) {
      clauses.push('sc.id_asesor_solicitante = @advisorId');
      params.advisorId = filters.advisorId;
    }
    if (filters.tipoSolicitud) {
      clauses.push('sc.tipo_solicitud = @tipoSolicitud');
      params.tipoSolicitud = filters.tipoSolicitud;
    }
    if (filters.estatus) {
      clauses.push('sc.estatus_solicitud = @estatus');
      params.estatus = filters.estatus;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT sc.*, p.address AS property_address, a.name AS advisor_name
      FROM public.fact_solicitudes_contrato sc
      LEFT JOIN public.properties p ON sc.id_propiedad = p.id
      LEFT JOIN public.advisors a ON sc.id_asesor_solicitante = a.id
      ${where}
      ORDER BY sc.fecha_solicitud DESC LIMIT @limit OFFSET @offset`;

    const countSql = `SELECT COUNT(*) as total FROM public.fact_solicitudes_contrato sc ${where}`;

    const [data, countResult] = await Promise.all([
      this.databaseService.query<any>(sql, params),
      this.databaseService.query<any>(countSql, params),
    ]);

    return {
      data,
      meta: {
        total: Number(countResult[0]?.total || 0),
        page,
        limit,
        totalPages: Math.ceil(Number(countResult[0]?.total || 0) / limit),
      },
    };
  }

  async findOne(id: string) {
    const rows = await this.databaseService.query<any>(
      `SELECT sc.*, p.address AS property_address, a.name AS advisor_name
       FROM public.fact_solicitudes_contrato sc
       LEFT JOIN public.properties p ON sc.id_propiedad = p.id
       LEFT JOIN public.advisors a ON sc.id_asesor_solicitante = a.id
       WHERE sc.id = @id LIMIT 1`,
      { id },
    );
    if (!rows.length)
      throw new NotFoundException(`Contrato ${id} no encontrado.`);
    return rows[0];
  }

  async updateStatus(
    id: string,
    estatus: string,
    updatedBy: string,
    observaciones?: string,
  ) {
    if (!VALID_STATUSES.includes(estatus)) {
      throw new BadRequestException(
        `Estatus inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}`,
      );
    }
    await this.findOne(id);
    await this.databaseService.query(
      `UPDATE public.fact_solicitudes_contrato
       SET estatus_solicitud = @estatus,
           observaciones_juridico = @obs,
           updated_at = NOW()
       WHERE id = @id`,
      { id, estatus, obs: observaciones ?? null },
    );
    return this.findOne(id);
  }
}
