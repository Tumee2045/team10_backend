import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { ConversationsModule } from './conversations/conversations.module';
import { FavoritesModule } from './favorites/favorites.module';
import { HealthModule } from './health/health.module';
import { ListingsModule } from './listings/listings.module';
import { LookupsModule } from './lookups/lookups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RentalRequestsModule } from './rental-requests/rental-requests.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    CloudinaryModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    LookupsModule,
    ListingsModule,
    FavoritesModule,
    SavedSearchesModule,
    RentalRequestsModule,
    ConversationsModule,
    ReviewsModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    // Order matters: authenticate first, then check roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
