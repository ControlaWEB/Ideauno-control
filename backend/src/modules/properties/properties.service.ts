import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PropertiesService {
  constructor(private databaseService: DatabaseService) {}

  async findAll(filters: {
    page?: number;
    limit?: number;
    location?: string;
    type?: string;
    status?: string;
    priceMin?: number;
    priceMax?: number;
    tipoOperacion?: string;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.location) {
      whereClauses.push(
        `LOWER(address) LIKE @location OR LOWER(city) LIKE @location OR LOWER(state) LIKE @location`,
      );
      params.location = `%${filters.location.toLowerCase()}%`;
    }
    if (filters.type) {
      whereClauses.push(`type = @type`);
      params.type = filters.type;
    }
    if (filters.status) {
      whereClauses.push(`status = @status`);
      params.status = filters.status;
    }
    if (filters.priceMin !== undefined && filters.priceMin !== null) {
      whereClauses.push(`price >= @priceMin`);
      params.priceMin = filters.priceMin;
    }
    if (filters.priceMax !== undefined && filters.priceMax !== null) {
      whereClauses.push(`price <= @priceMax`);
      params.priceMax = filters.priceMax;
    }
    if (filters.tipoOperacion) {
      whereClauses.push(`tipo_operacion = @tipoOperacion`);
      params.tipoOperacion = filters.tipoOperacion;
    }

    const whereString =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `SELECT * FROM public.properties
                 ${whereString}
                 ORDER BY created_at DESC
                 LIMIT @limit OFFSET @offset`;

    const countSql = `SELECT COUNT(*) as total FROM public.properties ${whereString}`;

    const [data, countResult] = await Promise.all([
      this.databaseService.query<any>(sql, params),
      this.databaseService.query<any>(countSql, params),
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async findOne(id: string) {
    const sql = `SELECT * FROM public.properties WHERE id = @id LIMIT 1`;
    const rows = await this.databaseService.query<any>(sql, { id });
    if (rows.length === 0) {
      throw new NotFoundException(`Propiedad con ID ${id} no encontrada.`);
    }
    // Copropietarios con su documento INE ligado (trazabilidad fuerte)
    const copropietarios = await this.databaseService.query<any>(
      `SELECT cp.id, cp.nombre, cp.orden, cp.documento_ine_id,
              d.nombre_archivo AS ine_nombre_archivo, d.estatus_documento AS ine_estatus
       FROM public.copropietarios cp
       LEFT JOIN public.dim_documentos d ON d.id = cp.documento_ine_id
       WHERE cp.property_id = @id
       ORDER BY cp.orden ASC`,
      { id },
    );
    return { ...rows[0], copropietarios_detalle: copropietarios };
  }

  // Reemplaza el listado de copropietarios de una propiedad, ligando cada uno
  // a su documento INE en dim_documentos. Idempotente: borra y reinserta.
  async saveCopropietarios(
    propertyId: string,
    lista: { nombre?: string; orden: number; documentoIneId?: string }[],
  ) {
    await this.findOne(propertyId); // valida existencia (404 si no)

    await this.databaseService.query(
      `DELETE FROM public.copropietarios WHERE property_id = @propertyId`,
      { propertyId },
    );

    for (const item of lista) {
      const id = 'cop-' + Math.random().toString(36).substring(2, 11);
      await this.databaseService.query(
        `INSERT INTO public.copropietarios (id, property_id, nombre, orden, documento_ine_id)
         VALUES (@id, @propertyId, @nombre, @orden, @documentoIneId)`,
        {
          id,
          propertyId,
          nombre: item.nombre || '',
          orden: item.orden,
          documentoIneId: item.documentoIneId || null,
        },
      );
    }

    return { success: true, total: lista.length };
  }

  async create(dto: Record<string, any>) {
    const id = 'prop-' + Math.random().toString(36).substring(2, 11);
    const autoStatus = dto.contratoComisionFirmado
      ? 'En revisión'
      : 'Incompleta';

    const sql = `INSERT INTO public.properties (
      id, code, folio, tipo_operacion, tipo_inmueble, type, status,
      owner_name, owner_phone, owner_email, owner_rfc, owner_curp, owner_estado_civil,
      adquirida_matrimonio, regimen_matrimonial, nombre_conyuge, conyuge_de_acuerdo,
      tiene_copropietarios, copropietarios, quien_realiza_venta,
      tiene_predial, tiene_agua, tiene_luz, tiene_avaluo,
      tiene_hipoteca, institucion_acreedora, saldo_hipoteca,
      proviene_herencia, adjudicacion_concluida,
      address, city, state, zona, maps_url,
      superficie_terreno_m2, superficie_construccion_m2, frente_m, fondo_m,
      recamaras, banos_completos, medios_banos, estacionamientos, niveles,
      antiguedad, estado_conservacion, situacion_actual,
      price, currency, es_negociable, formas_pago, cuota_mantenimiento,
      amenidades, description,
      advisor_id, fecha_captacion,
      autorizacion_promocion, tipo_autorizacion,
      contrato_comision_firmado, fecha_firma_contrato, vigencia_contrato,
      porcentaje_comision_pactado, observaciones_captacion
    ) VALUES (
      @id, @code, @folio, @tipoOperacion, @tipoInmueble, @type, @status,
      @ownerName, @ownerPhone, @ownerEmail, @ownerRfc, @ownerCurp, @ownerEstadoCivil,
      @adquiridaMatrimonio, @regimenMatrimonial, @nombreConyuge, @conyugeDeAcuerdo,
      @tieneCopropietarios, @copropietarios, @quienRealizaVenta,
      @tienePredial, @tieneAgua, @tieneLuz, @tieneAvaluo,
      @tieneHipoteca, @institucionAcreedora, @saldoHipoteca,
      @provieneHerencia, @adjudicacionConcluida,
      @address, @city, @state, @zona, @mapsUrl,
      @superficieTerreno, @superficieConstruccion, @frenteM, @fondoM,
      @recamaras, @banosCompletos, @mediosBanos, @estacionamientos, @niveles,
      @antiguedad, @estadoConservacion, @situacionActual,
      @price, @currency, @esNegociable, @formasPago, @cuotaMantenimiento,
      @amenidades, @description,
      @advisorId, @fechaCaptacion,
      @autorizacionPromocion, @tipoAutorizacion,
      @contratoComisionFirmado, @fechaFirmaContrato, @vigenciaContrato,
      @porcentajeComisionPactado, @observaciones
    )`;

    await this.databaseService.query(sql, {
      id,
      code: dto.code || id,
      folio: dto.folio || '',
      tipoOperacion: dto.tipoOperacion || 'Venta',
      tipoInmueble: dto.tipoInmueble || dto.type || '',
      type: dto.tipoInmueble || dto.type || 'Casa',
      status: dto.status || autoStatus,
      ownerName: dto.ownerName || '',
      ownerPhone: dto.ownerPhone || '',
      ownerEmail: dto.ownerEmail || '',
      ownerRfc: dto.ownerRfc || '',
      ownerCurp: dto.ownerCurp || '',
      ownerEstadoCivil: dto.ownerEstadoCivil || '',
      adquiridaMatrimonio: dto.adquiridaMatrimonio || 'no',
      regimenMatrimonial: dto.regimenMatrimonial || '',
      nombreConyuge: dto.nombreConyuge || '',
      conyugeDeAcuerdo: dto.conyugeDeAcuerdo || '',
      tieneCopropietarios: dto.tieneCopropietarios ? 'true' : 'false',
      copropietarios: dto.copropietarios || '[]',
      quienRealizaVenta: dto.quienRealizaVenta || 'Propietario',
      tienePredial: dto.tienePredial || 'no',
      tieneAgua: dto.tieneAgua || 'no',
      tieneLuz: dto.tieneLuz || 'no',
      tieneAvaluo: dto.tieneAvaluo || 'no',
      tieneHipoteca: dto.tieneHipoteca || 'no',
      institucionAcreedora: dto.institucionAcreedora || '',
      saldoHipoteca: dto.saldoHipoteca || 0,
      provieneHerencia: dto.provieneHerencia ? 'true' : 'false',
      adjudicacionConcluida: dto.adjudicacionConcluida ? 'true' : 'false',
      address: dto.address || '',
      city: dto.city || '',
      state: dto.state || '',
      zona: dto.zona || '',
      mapsUrl: dto.mapsUrl || '',
      superficieTerreno: dto.superficieTerreno || 0,
      superficieConstruccion: dto.superficieConstruccion || 0,
      frenteM: dto.frenteM || 0,
      fondoM: dto.fondoM || 0,
      recamaras: dto.recamaras || 0,
      banosCompletos: dto.banosCompletos || 0,
      mediosBanos: dto.mediosBanos || 0,
      estacionamientos: dto.estacionamientos || 0,
      niveles: dto.niveles || 0,
      antiguedad: dto.antiguedad || '',
      estadoConservacion: dto.estadoConservacion || '',
      situacionActual: dto.situacionActual || '',
      price: dto.price || 0,
      currency: dto.currency || 'MXN',
      esNegociable: dto.esNegociable ? 'true' : 'false',
      formasPago: dto.formasPago || '[]',
      cuotaMantenimiento: dto.cuotaMantenimiento || 0,
      amenidades: dto.amenidades || '',
      description: dto.description || '',
      advisorId: dto.advisorId || '',
      fechaCaptacion: dto.fechaCaptacion || null,
      autorizacionPromocion: dto.autorizacionPromocion ? 'true' : 'false',
      tipoAutorizacion: dto.tipoAutorizacion || '',
      contratoComisionFirmado: dto.contratoComisionFirmado ? 'true' : 'false',
      fechaFirmaContrato: dto.fechaFirmaContrato || null,
      vigenciaContrato: dto.vigenciaContrato || '',
      porcentajeComisionPactado: dto.porcentajeComisionPactado || 0,
      observaciones: dto.observaciones || '',
    });

    // Campos específicos de renta (formulario /rentals/new): antes se perdían
    // porque el INSERT principal no los incluye.
    if (
      dto.tipo_operacion_principal === 'Renta' ||
      dto.renta_mensual_solicitada !== undefined
    ) {
      await this.databaseService.query(
        `UPDATE public.properties SET
           tipo_operacion_principal  = @tipoOpPrincipal,
           tipo_operacion            = 'Renta',
           quien_realiza_contrato    = @quienContrata,
           doc_acredita_propiedad    = @docAcredita,
           renta_mensual_solicitada  = @rentaMensual,
           deposito_requerido        = @deposito,
           plazo_minimo_contrato     = @plazoMinimo,
           acepta_mascotas           = @aceptaMascotas,
           acepta_estudiantes        = @aceptaEstudiantes,
           acepta_empresas           = @aceptaEmpresas,
           requiere_aval             = @requiereAval,
           acepta_obligado_solidario = @aceptaObligado,
           requiere_poliza_juridica  = @requierePoliza,
           servicios_incluidos       = @servicios,
           equipamiento_incluido     = @equipamiento,
           disponible_mostrarse      = @disponible,
           fecha_disponibilidad      = @fechaDisponibilidad,
           autoriza_promocion        = @autorizaPromocion
         WHERE id = @id`,
        {
          id,
          tipoOpPrincipal: dto.tipo_operacion_principal || 'Renta',
          quienContrata: dto.quien_realiza_contrato || '',
          docAcredita: dto.doc_acredita_propiedad || '',
          rentaMensual: dto.renta_mensual_solicitada ?? 0,
          deposito: dto.deposito_requerido || '',
          plazoMinimo: dto.plazo_minimo_contrato || '',
          aceptaMascotas: dto.acepta_mascotas || '',
          aceptaEstudiantes: dto.acepta_estudiantes || '',
          aceptaEmpresas: dto.acepta_empresas ? 'true' : 'false',
          requiereAval: dto.requiere_aval ? 'true' : 'false',
          aceptaObligado: dto.acepta_obligado_solidario ? 'true' : 'false',
          requierePoliza: dto.requiere_poliza_juridica ? 'true' : 'false',
          servicios: dto.servicios_incluidos || '[]',
          equipamiento: dto.equipamiento_incluido || '[]',
          disponible: dto.disponible_mostrarse ? 'true' : 'false',
          fechaDisponibilidad: dto.fecha_disponibilidad || null,
          autorizaPromocion: dto.autorizacionPromocion ? 'true' : 'false',
        },
      );
    }

    // Insert captation record in fact_captaciones
    const captacionId = 'cap-' + Math.random().toString(36).substring(2, 11);
    await this.databaseService.query(
      `INSERT INTO public.fact_captaciones (
         id, id_propiedad, id_asesor, tipo_captacion, fecha_captacion,
         autorizacion_promocion, tipo_autorizacion, contrato_comision_firmado,
         estatus_captacion, observaciones
       ) VALUES (
         @captacionId, @propId, @advisorId, @tipoCaptacion, @fechaCaptacion,
         @autorizacion, @tipoAutorizacion, @contratoFirmado,
         @estatus, @observaciones
       )`,
      {
        captacionId,
        propId: id,
        advisorId: dto.advisorId || '',
        tipoCaptacion: dto.tipoOperacion || 'Venta',
        fechaCaptacion: dto.fechaCaptacion || null,
        autorizacion: dto.autorizacionPromocion ? 'true' : 'false',
        tipoAutorizacion: dto.tipoAutorizacion || '',
        contratoFirmado: dto.contratoComisionFirmado ? 'true' : 'false',
        estatus: dto.status || autoStatus,
        observaciones: dto.observaciones || '',
      },
    );

    // Insert propietario into dim_clientes if data provided
    if (dto.ownerName) {
      const clienteId = 'cli-' + Math.random().toString(36).substring(2, 11);
      await this.databaseService.query(
        `INSERT INTO public.dim_clientes (
           id, tipo_cliente, nombre_razon_social, persona_tipo,
           telefono, correo, rfc, curp, estado_civil
         ) VALUES (
           @clienteId, @tipoCliente, @nombre, @personaTipo,
           @telefono, @correo, @rfc, @curp, @estadoCivil
         )`,
        {
          clienteId,
          tipoCliente: 'Propietario',
          nombre: dto.ownerName,
          personaTipo: 'Persona física',
          telefono: dto.ownerPhone || '',
          correo: dto.ownerEmail || '',
          rfc: dto.ownerRfc || '',
          curp: dto.ownerCurp || '',
          estadoCivil: dto.ownerEstadoCivil || '',
        },
      );

      // Link propietario to property via bridge table
      const relacionId = 'rel-' + Math.random().toString(36).substring(2, 11);
      await this.databaseService.query(
        `INSERT INTO public.bridge_propiedad_propietarios (
           id, id_propiedad, id_cliente, tipo_relacion, es_propietario_principal
         ) VALUES (
           @relacionId, @propId, @clienteId, @tipoRelacion, 'true'
         )`,
        {
          relacionId,
          propId: id,
          clienteId,
          tipoRelacion: dto.quienRealizaVenta || 'Propietario',
        },
      );
    }

    return { id, status: dto.status || autoStatus };
  }

  // Mapa explícito campo→columna: los keys del body NUNCA se interpolan en el SQL.
  // Nota: superficieTerreno/Construccion mapean a columnas *_m2.
  private static readonly UPDATABLE_COLUMNS: Record<string, string> = {
    code: 'code',
    folio: 'folio',
    tipoOperacion: 'tipo_operacion',
    tipoInmueble: 'tipo_inmueble',
    type: 'type',
    status: 'status',
    ownerName: 'owner_name',
    ownerPhone: 'owner_phone',
    ownerEmail: 'owner_email',
    ownerRfc: 'owner_rfc',
    ownerCurp: 'owner_curp',
    ownerEstadoCivil: 'owner_estado_civil',
    adquiridaMatrimonio: 'adquirida_matrimonio',
    regimenMatrimonial: 'regimen_matrimonial',
    nombreConyuge: 'nombre_conyuge',
    conyugeDeAcuerdo: 'conyuge_de_acuerdo',
    tieneCopropietarios: 'tiene_copropietarios',
    copropietarios: 'copropietarios',
    quienRealizaVenta: 'quien_realiza_venta',
    tienePredial: 'tiene_predial',
    tieneAgua: 'tiene_agua',
    tieneLuz: 'tiene_luz',
    tieneAvaluo: 'tiene_avaluo',
    tieneHipoteca: 'tiene_hipoteca',
    institucionAcreedora: 'institucion_acreedora',
    saldoHipoteca: 'saldo_hipoteca',
    provieneHerencia: 'proviene_herencia',
    adjudicacionConcluida: 'adjudicacion_concluida',
    address: 'address',
    city: 'city',
    state: 'state',
    zona: 'zona',
    mapsUrl: 'maps_url',
    superficieTerreno: 'superficie_terreno_m2',
    superficieConstruccion: 'superficie_construccion_m2',
    frenteM: 'frente_m',
    fondoM: 'fondo_m',
    recamaras: 'recamaras',
    banosCompletos: 'banos_completos',
    mediosBanos: 'medios_banos',
    estacionamientos: 'estacionamientos',
    niveles: 'niveles',
    antiguedad: 'antiguedad',
    estadoConservacion: 'estado_conservacion',
    situacionActual: 'situacion_actual',
    price: 'price',
    currency: 'currency',
    esNegociable: 'es_negociable',
    formasPago: 'formas_pago',
    cuotaMantenimiento: 'cuota_mantenimiento',
    amenidades: 'amenidades',
    description: 'description',
    advisorId: 'advisor_id',
    fechaCaptacion: 'fecha_captacion',
    autorizacionPromocion: 'autorizacion_promocion',
    tipoAutorizacion: 'tipo_autorizacion',
    contratoComisionFirmado: 'contrato_comision_firmado',
    fechaFirmaContrato: 'fecha_firma_contrato',
    vigenciaContrato: 'vigencia_contrato',
    porcentajeComisionPactado: 'porcentaje_comision_pactado',
    observaciones: 'observaciones_captacion',
  };

  async update(id: string, dto: Partial<any>) {
    await this.findOne(id);

    const fields = Object.keys(dto).filter(
      (f) =>
        PropertiesService.UPDATABLE_COLUMNS[f] !== undefined &&
        dto[f] !== undefined,
    );
    if (fields.length === 0) return this.findOne(id);

    const setClauses = fields.map(
      (field) => `${PropertiesService.UPDATABLE_COLUMNS[field]} = @${field}`,
    );

    const sql = `UPDATE public.properties SET ${setClauses.join(', ')} WHERE id = @id`;
    const params: Record<string, any> = { id };
    for (const f of fields) {
      // Booleans viajan como texto 'true'/'false' (las funciones exec_sql_* los castean)
      params[f] =
        typeof dto[f] === 'boolean' ? (dto[f] ? 'true' : 'false') : dto[f];
    }
    await this.databaseService.query(sql, params);

    return this.findOne(id);
  }

  async updateStatus(id: string, status: string) {
    // 'Compartida' es el valor que envía la UI; 'Compartible' se conserva por compatibilidad
    const BLOCKED_STATUSES = [
      'Activa',
      'Publicable',
      'Compartible',
      'Compartida',
    ];

    if (BLOCKED_STATUSES.includes(status)) {
      const prop = await this.findOne(id);
      if (
        prop.contrato_comision_firmado !== 'true' &&
        prop.contrato_comision_firmado !== true
      ) {
        throw new BadRequestException(
          'La propiedad no puede activarse sin contrato de comisión mercantil firmado. Actualiza el contrato antes de cambiar el estatus.',
        );
      }
      if (
        (prop.proviene_herencia === 'true' ||
          prop.proviene_herencia === true) &&
        prop.adjudicacion_concluida !== 'true' &&
        prop.adjudicacion_concluida !== true
      ) {
        throw new BadRequestException(
          'La propiedad proviene de herencia con adjudicación no concluida. No puede publicarse hasta completar el proceso de adjudicación.',
        );
      }
    }

    await this.databaseService.query(
      `UPDATE public.properties SET status = @status WHERE id = @id`,
      { id, status },
    );

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    const sql = `DELETE FROM public.properties WHERE id = @id`;
    await this.databaseService.query(sql, { id });
    return { success: true };
  }
}
