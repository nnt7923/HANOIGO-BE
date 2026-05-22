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
import { CreatePlaceDto } from './dto/create-place.dto';
import { PlaceQueryDto } from './dto/place-query.dto';
import { RejectPlaceDto } from './dto/reject-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { PlacesService } from './places.service';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  findAll(@Query() query: PlaceQueryDto) {
    return this.placesService.findPublic(query);
  }

  @Get('manage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Owner, UserRole.Admin)
  findManage(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PlaceQueryDto,
  ) {
    return this.placesService.findManage(user, query);
  }

  @Get('manage/:identifier')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Owner, UserRole.Admin)
  findManageOne(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placesService.findManageByIdOrSlug(identifier, user);
  }

  @Get(':identifier')
  findOne(@Param('identifier') identifier: string) {
    return this.placesService.findPublicByIdOrSlug(identifier);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Owner, UserRole.Admin)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlaceDto) {
    return this.placesService.create(user, dto);
  }

  @Patch(':identifier')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Owner, UserRole.Admin)
  update(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePlaceDto,
  ) {
    return this.placesService.update(identifier, user, dto);
  }

  @Delete(':identifier')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Owner, UserRole.Admin)
  remove(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placesService.remove(identifier, user);
  }

  @Post(':identifier/approve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  approve(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placesService.approve(identifier, user);
  }

  @Post(':identifier/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  reject(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPlaceDto,
  ) {
    return this.placesService.reject(identifier, user, dto.reason);
  }

  @Post(':identifier/suspend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  suspend(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<RejectPlaceDto>,
  ) {
    return this.placesService.suspend(identifier, user, dto.reason);
  }
}
