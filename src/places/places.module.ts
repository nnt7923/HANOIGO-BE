import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { Place, PlaceSchema } from './schemas/place.schema';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  imports: [
    UsersModule,
    UploadsModule,
    MongooseModule.forFeature([{ name: Place.name, schema: PlaceSchema }]),
  ],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
