import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

// Supabase (plan Free) pausa el proyecto tras ~7 días con poca actividad de
// BD. Un SELECT 1 periódico desde el backend lo mantiene activo aunque nadie
// use la app. Al arrancar ya hay un ping (DatabaseService.onModuleInit).
const INTERVAL_MS = 4 * 60 * 60 * 1000; // cada 4 h

@Injectable()
export class DbKeepAliveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KeepAlive');
  private timer?: NodeJS.Timeout;

  constructor(private db: DatabaseService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.ping(), INTERVAL_MS);
    // No retiene el proceso al apagar.
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async ping() {
    try {
      await this.db.query('SELECT 1 AS ok');
    } catch (err) {
      this.logger.warn(`Ping a la BD falló: ${(err as Error).message}`);
    }
  }
}
