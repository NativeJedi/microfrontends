import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from './auth/access-token.guard';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { RefreshTokensService } from './auth/refresh-tokens.service';
import { ACCESS_TOKEN_TTL_SECONDS, DEV_JWT_SECRET } from './auth/token-lifetimes';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

@Module({
  imports: [
    JwtModule.register({
      secret: DEV_JWT_SECRET,
      signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    }),
  ],
  controllers: [AuthController, ProductsController, OrdersController],
  providers: [
    AuthService,
    RefreshTokensService,
    ProductsService,
    OrdersService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
})
export class AppModule {}
