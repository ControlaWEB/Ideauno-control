import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const sql = `SELECT * FROM public.usuarios WHERE email = @email LIMIT 1`;
    const users = await this.databaseService.query<any>(sql, { email });

    if (users.length === 0) {
      throw new UnauthorizedException('Credenciales inválidas: correo no registrado.');
    }

    const user = users[0];
    if (user.status !== 'Active') {
      throw new UnauthorizedException('Cuenta suspendida o inactiva.');
    }

    const isMatch = await bcrypt.compare(pass, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas: contraseña incorrecta.');
    }

    // Resolve advisor ID if role is Asesor
    let advisorId: string | null = null;
    if (user.role === 'Asesor') {
      const advRows = await this.databaseService.query<any>(
        `SELECT id FROM public.advisors WHERE user_id = @uid LIMIT 1`,
        { uid: user.id },
      );
      advisorId = advRows[0]?.id ?? null;
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role, advisorId };

    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET env var not set');
    if (!jwtRefreshSecret) throw new Error('JWT_REFRESH_SECRET env var not set');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: jwtRefreshSecret,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        advisorId,
        avatarUrl: user.avatar_url,
      },
    };
  }

  async refresh(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? (() => { throw new Error('JWT_REFRESH_SECRET not set'); })(),
      });

      const newPayload = { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
      const accessToken = await this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET not set'); })(),
        expiresIn: '15m',
      });

      return { accessToken };
    } catch (err) {
      throw new UnauthorizedException('Token de actualización expirado o inválido.');
    }
  }

  async getMe(userId: string) {
    const rows = await this.databaseService.query<any>(
      `SELECT id, name, email, role, status, avatar_url FROM public.usuarios WHERE id = @id LIMIT 1`,
      { id: userId },
    );
    if (!rows.length) throw new UnauthorizedException('Usuario no encontrado.');
    const user = rows[0];

    let advisorId: string | null = null;
    if (user.role === 'Asesor') {
      const advRows = await this.databaseService.query<any>(
        `SELECT id FROM public.advisors WHERE user_id = @uid LIMIT 1`,
        { uid: user.id },
      );
      advisorId = advRows[0]?.id ?? null;
    }

    return { ...user, advisorId };
  }

  async register(name: string, email: string, pass: string, role: string) {
    const checkSql = `SELECT * FROM public.usuarios WHERE email = @email LIMIT 1`;
    const existing = await this.databaseService.query<any>(checkSql, { email });
    if (existing.length > 0) {
      throw new BadRequestException('El correo electrónico ya está registrado.');
    }

    const id = randomUUID();
    const passHash = await bcrypt.hash(pass, 10);
    const insertSql = `INSERT INTO public.usuarios (id, name, email, password_hash, role, status, avatar_url)
                       VALUES (@id, @name, @email, @hash, @role, 'Active', '')`;

    await this.databaseService.query(insertSql, {
      id,
      name,
      email,
      hash: passHash,
      role,
    });

    if (role === 'Asesor') {
      const advId = 'ADV-' + Math.floor(1000 + Math.random() * 9000);
      const insertAdv = `INSERT INTO public.advisors (id, user_id, name, email, phone, specialty, license, status, invite_by_advisor_id, meta_ama)
                         VALUES (@advId, @userId, @name, @email, '', 'General', '', 'Activo', 'Directo', 0)`;
      await this.databaseService.query(insertAdv, {
        advId,
        userId: id,
        name,
        email,
      });
    }

    return {
      id,
      name,
      email,
      role,
      status: 'Active',
    };
  }
}
