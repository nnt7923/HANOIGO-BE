import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SocialService } from './social.service';

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('feed')
  feed(@Query() query: PostQueryDto) {
    return this.socialService.feed(query);
  }

  @Get('feed/following')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  followingFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PostQueryDto,
  ) {
    return this.socialService.followingFeed(user, query);
  }

  @Get('places/:placeId/posts')
  placeFeed(@Param('placeId') placeId: string, @Query() query: PostQueryDto) {
    return this.socialService.placeFeed(placeId, query);
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.socialService.getPost(id);
  }

  @Post('posts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.socialService.createPost(user, dto);
  }

  @Patch('posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updatePost(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePostDto,
  ) {
    return this.socialService.updatePost(id, user, dto);
  }

  @Delete('posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deletePost(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.deletePost(id, user);
  }

  @Post('posts/:id/like')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  like(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.like(id, user);
  }

  @Delete('posts/:id/like')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  unlike(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.unlike(id, user);
  }

  @Post('posts/:id/save')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  save(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.save(id, user);
  }

  @Delete('posts/:id/save')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  unsave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialService.unsave(id, user);
  }

  @Get('posts/:id/comments')
  comments(@Param('id') id: string, @Query() query: PostQueryDto) {
    return this.socialService.comments(id, query);
  }

  @Post('posts/:id/comments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  comment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.socialService.comment(id, user, dto);
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.deleteComment(id, user);
  }

  @Post('comments/:id/report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reportComment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReportPostDto,
  ) {
    return this.socialService.reportComment(id, user, dto);
  }

  @Patch('comments/:id/hide')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  hideComment(@Param('id') id: string) {
    return this.socialService.hideComment(id);
  }

  @Patch('comments/:id/unhide')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  unhideComment(@Param('id') id: string) {
    return this.socialService.unhideComment(id);
  }

  @Post('posts/:id/report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  report(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReportPostDto,
  ) {
    return this.socialService.report(id, user, dto);
  }

  @Patch('posts/:id/hide')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  hide(@Param('id') id: string) {
    return this.socialService.hide(id);
  }

  @Patch('posts/:id/unhide')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  unhide(@Param('id') id: string) {
    return this.socialService.unhide(id);
  }

  @Post('follows/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  follow(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.follow(user, userId);
  }

  @Delete('follows/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  unfollow(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialService.unfollow(user, userId);
  }
}
