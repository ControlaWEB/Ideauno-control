import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseService } from '../database/database.service';

/**
 * GET /api/health — verificación real para el balanceador/monitor.
 * Sin autenticación y sin datos: solo confirma que la BD responde.
 */
@Controller('health')
// El throttler global se llama 'short' (app.module): @SkipThrottle() sin
// argumentos solo salta el throttler 'default' y aquí no tendría efecto.
@SkipThrottle({ short: true })
export class HealthController {
  constructor(private db: DatabaseService) {}

  @Get()
  async check() {
    try {
      await this.db.query('SELECT 1 AS ok');
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error' });
    }
  }
}
