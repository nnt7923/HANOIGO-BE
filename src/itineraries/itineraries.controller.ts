import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { UpdateItineraryVisibilityDto } from './dto/update-itinerary-visibility.dto';
import { ItinerariesService } from './itineraries.service';

@ApiTags('itineraries')
@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.itinerariesService.findMine(user.id);
  }

  @Get('public')
  findPublic() {
    return this.itinerariesService.findPublic();
  }

  @Post('generate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateItineraryDto,
  ) {
    return this.itinerariesService.generate(user, dto);
  }

  @Patch(':id/visibility')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateVisibility(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateItineraryVisibilityDto,
  ) {
    return this.itinerariesService.updateVisibility(id, user, dto.visibility);
  }

  @Post(':id/clone')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  clone(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.itinerariesService.clone(id, user);
  }
}
