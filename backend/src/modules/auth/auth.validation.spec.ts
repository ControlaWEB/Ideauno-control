import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Tests de validación del módulo auth: comprueban que el ValidationPipe
 * global (whitelist + forbidNonWhitelisted) rechaza payloads inválidos con 400
 * antes de llegar al servicio.
 */
describe('Auth validation (DTO + ValidationPipe)', () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn().mockResolvedValue({ ok: true }),
    register: jest.fn().mockResolvedValue({ ok: true }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
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

  afterAll(async () =>
    app.close());

  beforeEach(() => jest.clearAllMocks());

  describe('POST /auth/login', () => {
    it('rechaza body vacío con 400', async () => {
      await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('rechaza email inválido con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-es-un-correo', password: 'x1234567' })
        .expect(400);
    });

    it('rechaza contraseña vacía con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.com', password: '' })
        .expect(400);
    });

    it('rechaza campos extra no declarados con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'x1234567', admin: true })
        .expect(400);
    });

    it('normaliza el email a minúsculas y sin espacios', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: '  USER@Ideauno.COM ', password: 'x1234567' })
        .expect(201);
      expect(authService.login).toHaveBeenCalledWith('user@ideauno.com', 'x1234567');
    });
  });

  describe('POST /auth/register', () => {
    const valid = {
      name: 'María López',
      email: 'maria@ideauno.com',
      password: 'Secreta123!',
      role: 'Asesor',
    };

    it('acepta un payload válido', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(valid).expect(201);
    });

    it('rechaza nombre con números con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...valid, name: 'Maria 123' })
        .expect(400);
    });

    it('rechaza rol fuera del catálogo con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...valid, role: 'Hacker' })
        .expect(400);
    });

    it('rechaza contraseña corta (< 8) con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...valid, password: 'abc' })
        .expect(400);
    });
  });
});
