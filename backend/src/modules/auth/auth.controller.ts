import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsString,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  MAX_EMAIL,
  MAX_NOMBRE,
  SOLO_LETRAS,
  MSG,
} from '../../common/validation/patterns';
import { Matches } from 'class-validator';

class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  @MaxLength(MAX_EMAIL, {
    message: 'El correo electrónico es demasiado largo.',
  })
  email: string;

  @IsString({ message: 'La contraseña debe ser texto.' })
  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  @MaxLength(128, { message: 'La contraseña es demasiado larga.' })
  password: string;
}

class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'El nombre es requerido.' })
  @MaxLength(MAX_NOMBRE, {
    message: `El nombre no puede exceder ${MAX_NOMBRE} caracteres.`,
  })
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  @MaxLength(MAX_EMAIL, {
    message: 'El correo electrónico es demasiado largo.',
  })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128, { message: 'La contraseña es demasiado larga.' })
  password: string;

  @IsNotEmpty({ message: 'El rol es requerido.' })
  @IsIn(Object.values(UserRole), {
    message: `El rol debe ser uno de: ${Object.values(UserRole).join(', ')}.`,
  })
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Límite estricto contra fuerza bruta: 10 intentos por minuto por IP
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Throttle({ short: { ttl: 60000, limit: 30 } })
  @Post('refresh')
  async refresh(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Refresh token is required.');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.authService.refresh(token);
  }

  // Register is protected so only Super Admin and Admin can create accounts
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(
      body.name,
      body.email,
      body.password,
      body.role,
    );
  }
}
