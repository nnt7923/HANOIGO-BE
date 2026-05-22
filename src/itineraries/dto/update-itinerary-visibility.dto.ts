import { IsEnum } from 'class-validator';
import { ItineraryVisibility } from '../schemas/itinerary.schema';

export class UpdateItineraryVisibilityDto {
  @IsEnum(ItineraryVisibility)
  visibility: ItineraryVisibility;
}
