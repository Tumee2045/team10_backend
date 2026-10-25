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
import { ReviewsService } from '../reviews/reviews.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly reviews: ReviewsService,
  ) {}

  async findMe(userId: bigint) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** What anyone can see: no email, plus rating and active listing count. */
  async findPublicProfile(id: bigint) {
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
      this.reviews.ratingSummary(id),
      this.prisma.listing.count({
        where: { ownerId: id, status: ListingStatus.ACTIVE },
      }),
    ]);
    return { ...user, rating, activeListings };
  }

  updateProfile(userId: bigint, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto): Promise<void> {
    const { passwordHash } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const isCurrentCorrect = await bcrypt.compare(
      dto.currentPassword,
      passwordHash,
    );
    if (!isCurrentCorrect) {
      throw new BadRequestException('Current password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
  }

  async uploadAvatar(userId: bigint, file: Express.Multer.File) {
    const image = await this.cloudinary.upload(file, 'avatars');
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: image.url },
    });
  }
}
