import { Controller, Post, Get, Body, Headers, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsEmail, IsNotEmpty, MinLength, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres.' })
  password: string;
}

class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es requerido.' })
  name: string;

  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres.' })
  password: string;

  @IsNotEmpty({ message: 'El rol es requerido.' })
  @IsString()
  role: string; // Super Admin, Director, Gerente, Asesor, Jurídico
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Post('refresh')
  async refresh(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Refresh token is required.');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.authService.refresh(token);
  }

  // Register is protected so only Super Admin and Director can create accounts
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.name, body.email, body.password, body.role);
  }
}
