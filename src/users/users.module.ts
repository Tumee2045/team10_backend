import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ReviewsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
