import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('places/:placeIdentifier/reviews')
  findForPlace(@Param('placeIdentifier') placeIdentifier: string) {
    return this.reviewsService.findForPlace(placeIdentifier);
  }

  @Post('places/:placeIdentifier/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('placeIdentifier') placeIdentifier: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(placeIdentifier, user, dto);
  }

  @Patch('reviews/:reviewId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(reviewId, user, dto);
  }

  @Delete('reviews/:reviewId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.remove(reviewId, user);
  }

  @Post('reviews/:reviewId/report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  report(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReportReviewDto,
  ) {
    return this.reviewsService.report(reviewId, user, dto);
  }

  @Post('reviews/:reviewId/reply')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reply(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.reply(reviewId, user, dto);
  }

  @Patch('reviews/:reviewId/hide')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  hide(@Param('reviewId') reviewId: string) {
    return this.reviewsService.hide(reviewId);
  }

  @Patch('reviews/:reviewId/unhide')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  unhide(@Param('reviewId') reviewId: string) {
    return this.reviewsService.unhide(reviewId);
  }
}
