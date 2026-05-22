import {
  Body,
  Controller,
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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateOwnerRequestDto } from './dto/create-owner-request.dto';
import { ReviewOwnerRequestDto } from './dto/review-owner-request.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const found = await this.usersService.findByIdOrThrow(user.id);
    return this.usersService.toSafeUser(found);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('me/quota')
  getMyQuota(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getQuota(user.id);
  }

  @Post('me/owner-request')
  requestOwnerRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOwnerRequestDto,
  ) {
    return this.usersService.requestOwnerRole(user.id, dto);
  }

  @Get('owner-requests')
  @Roles(UserRole.Admin)
  findOwnerRequests(@Query() query: PaginationQueryDto) {
    return this.usersService.findOwnerRequests(query);
  }

  @Post('owner-requests/:id/approve')
  @Roles(UserRole.Admin)
  approveOwnerRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.approveOwnerRequest(id, user.id);
  }

  @Post('owner-requests/:id/reject')
  @Roles(UserRole.Admin)
  rejectOwnerRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewOwnerRequestDto,
  ) {
    return this.usersService.rejectOwnerRequest(id, user.id, dto);
  }

  @Get()
  @Roles(UserRole.Admin)
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Patch(':id/role')
  @Roles(UserRole.Admin)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(id, dto);
  }

  @Patch(':id/subscription')
  @Roles(UserRole.Admin)
  updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.usersService.updateSubscription(id, dto);
  }
}
