import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global: convierte errores de BD/Supabase en respuestas 4xx claras
 * y evita exponer stack traces o detalles internos en errores 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
      return;
    }

    // Errores de Postgres/Supabase (llegan como objetos con code/message)
    const err = exception as {
      code?: string;
      message?: string;
      stack?: string;
    };
    const pgCode = err?.code ?? '';
    const rawMessage = err?.message ?? '';

    // Los RPC exec_sql_* envuelven el error PG en el message; detectar por texto también
    const isUnique =
      pgCode === '23505' ||
      /duplicate key|llave duplicada|unique constraint/i.test(rawMessage);
    const isForeignKey =
      pgCode === '23503' || /foreign key|llave foránea/i.test(rawMessage);
    const isNotNull =
      pgCode === '23502' ||
      /null value in column|valor nulo en la columna/i.test(rawMessage);
    const isInvalidText =
      pgCode === '22P02' ||
      /invalid input syntax|sintaxis de entrada no válida/i.test(rawMessage);
    const isCheck = pgCode === '23514' || /check constraint/i.test(rawMessage);

    if (isUnique) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Ya existe un registro con esos datos (valor duplicado).',
        error: 'Conflict',
      });
      return;
    }

    if (isForeignKey || isNotNull || isInvalidText || isCheck) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'Los datos enviados no son válidos o hacen referencia a registros inexistentes.',
        error: 'Bad Request',
      });
      return;
    }

    this.logger.error(
      `Error no controlado en ${request?.method} ${request?.url}: ${rawMessage}`,
      err?.stack,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor. Intenta de nuevo más tarde.',
      error: 'Internal Server Error',
    });
  }
}
