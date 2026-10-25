import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async me(userId: bigint) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Public profile: no email, plus rating summary and active listing count. */
  async publicProfile(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        phone: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [rating, activeListings] = await Promise.all([
      this.prisma.review.aggregate({
        where: { targetUserId: id },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.listing.count({
        where: { ownerId: id, status: ListingStatus.ACTIVE },
      }),
    ]);

    return {
      ...user,
      rating: {
        average: rating._avg.rating
          ? Math.round(rating._avg.rating * 10) / 10
          : null,
        count: rating._count,
      },
      activeListings,
    };
  }

  updateProfile(userId: bigint, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    return { ok: true };
  }

  async uploadAvatar(userId: bigint, file: Express.Multer.File) {
    const img = await this.cloudinary.upload(file, 'avatars');
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: img.url },
    });
  }
}
