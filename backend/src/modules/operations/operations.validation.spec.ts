import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Tests de validación del módulo operations (motor de comisiones):
 * letras en campos numéricos, negativos, NaN, estatus fuera de catálogo
 * y paginación inválida deben dar 400.
 */
describe('Operations validation (DTO + ValidationPipe)', () => {
  let app: INestApplication;
  const operationsService = {
    create: jest.fn().mockResolvedValue({ id: 'op-test' }),
    findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    findAllCommissions: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    updateStatus: jest.fn().mockResolvedValue({}),
    cancel: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [{ provide: OperationsService, useValue: operationsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            id: 'u-1',
            role: 'Admin',
            advisorId: null,
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => jest.clearAllMocks());

  describe('POST /operations', () => {
    it('rechaza letras en monto de comisión con 400', async () => {
      await request(app.getHttpServer())
        .post('/operations')
        .send({ tipoOperacion: 'Venta', montoComisionGenerada: 'abc' })
        .expect(400);
      expect(operationsService.create).not.toHaveBeenCalled();
    });

    it('rechaza monto negativo con 400', async () => {
      await request(app.getHttpServer())
        .post('/operations')
        .send({ tipoOperacion: 'Venta', montoComisionGenerada: -500 })
        .expect(400);
    });

    it('rechaza tipo de operación fuera de catálogo con 400', async () => {
      await request(app.getHttpServer())
        .post('/operations')
        .send({ tipoOperacion: 'Permuta' })
        .expect(400);
    });

    it('rechaza fecha de cierre con formato inválido con 400', async () => {
      await request(app.getHttpServer())
        .post('/operations')
        .send({ tipoOperacion: 'Venta', fechaCierre: '31/12/2025' })
        .expect(400);
    });

    it('rechaza tasa de comisión mayor a 100 con 400', async () => {
      await request(app.getHttpServer())
        .post('/operations')
        .send({ tipoOperacion: 'Venta', commissionRate: 250 })
        .expect(400);
    });

    it('acepta un cierre válido', async () => {
      await request(app.getHttpServer())
        .post('/operations')
        .send({
          tipoOperacion: 'Venta',
          precioFinalCierre: 1500000,
          montoComisionGenerada: 75000,
          fechaCierre: '2026-06-30',
          advisorId: 'ADV-1234',
        })
        .expect(201);
      expect(operationsService.create).toHaveBeenCalled();
    });
  });

  describe('PATCH /operations/:id/status', () => {
    it('rechaza estatus fuera de catálogo con 400', async () => {
      await request(app.getHttpServer())
        .patch('/operations/op-1/status')
        .send({ status: 'EstadoInventado' })
        .expect(400);
      expect(operationsService.updateStatus).not.toHaveBeenCalled();
    });

    it('rechaza estatus vacío con 400', async () => {
      await request(app.getHttpServer())
        .patch('/operations/op-1/status')
        .send({ status: '' })
        .expect(400);
    });
  });

  describe('PATCH /operations/:id/cancel', () => {
    it('rechaza cancelación sin motivo con 400', async () => {
      await request(app.getHttpServer())
        .patch('/operations/op-1/cancel')
        .send({})
        .expect(400);
      expect(operationsService.cancel).not.toHaveBeenCalled();
    });
  });

  describe('GET /operations (paginación)', () => {
    it('rechaza page=0 con 400', async () => {
      await request(app.getHttpServer()).get('/operations?page=0').expect(400);
    });

    it('rechaza limit=999 (tope 100) con 400', async () => {
      await request(app.getHttpServer()).get('/operations?limit=999').expect(400);
    });

    it('rechaza page no numérico con 400', async () => {
      await request(app.getHttpServer()).get('/operations?page=abc').expect(400);
    });

    it('acepta paginación válida', async () => {
      await request(app.getHttpServer()).get('/operations?page=2&limit=10').expect(200);
    });
  });
});
