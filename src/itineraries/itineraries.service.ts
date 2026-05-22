import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PlacesService } from '../places/places.service';
import { PlaceDocument } from '../places/schemas/place.schema';
import { UsersService } from '../users/users.service';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import {
  Itinerary,
  ItineraryDocument,
  ItinerarySource,
  ItineraryVisibility,
} from './schemas/itinerary.schema';

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name)
    private readonly itineraryModel: Model<ItineraryDocument>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly placesService: PlacesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findMine(userId: string) {
    return this.itineraryModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .populate('places', 'name slug category address ratingAverage location')
      .exec();
  }

  findPublic() {
    return this.itineraryModel
      .find({ visibility: ItineraryVisibility.Public })
      .sort({ cloneCount: -1, createdAt: -1 })
      .populate('user', 'name avatarUrl')
      .populate('places', 'name slug category address ratingAverage location')
      .exec();
  }

  async updateVisibility(
    itineraryId: string,
    user: AuthenticatedUser,
    visibility: ItineraryVisibility,
  ) {
    const itinerary = await this.findOwnedItineraryOrThrow(
      itineraryId,
      user.id,
    );
    itinerary.visibility = visibility;
    return itinerary.save();
  }

  async clone(itineraryId: string, user: AuthenticatedUser) {
    const source = await this.itineraryModel
      .findOne({
        _id: itineraryId,
        visibility: {
          $in: [ItineraryVisibility.Public, ItineraryVisibility.Unlisted],
        },
      })
      .exec();

    if (!source) {
      throw new NotFoundException('Itinerary not found');
    }

    const cloned = await this.itineraryModel.create({
      user: new Types.ObjectId(user.id),
      title: `${source.title} (copy)`,
      area: source.area,
      days: source.days,
      budgetVnd: source.budgetVnd,
      preferences: source.preferences,
      places: source.places,
      plan: source.plan,
      cacheKey: `${source.cacheKey}:clone:${user.id}:${Date.now()}`,
      source: source.source,
      visibility: ItineraryVisibility.Private,
      clonedFrom: source._id,
    });

    await this.itineraryModel
      .findByIdAndUpdate(source._id, { $inc: { cloneCount: 1 } })
      .exec();

    return cloned.populate(
      'places',
      'name slug category address ratingAverage location',
    );
  }

  async generate(user: AuthenticatedUser, dto: GenerateItineraryDto) {
    const account = await this.usersService.resetUsageIfNeeded(
      await this.usersService.findByIdOrThrow(user.id),
    );

    if (account.itineraryUsageCount >= account.monthlyItineraryLimit) {
      throw new ForbiddenException('Monthly itinerary limit reached');
    }

    const cacheKey = this.createCacheKey(dto);
    const cached = await this.itineraryModel
      .findOne({
        cacheKey,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();

    const nearbyPlaces = await this.findRelevantPlaces(dto);
    const generated = cached
      ? { payload: cached.plan, source: ItinerarySource.Cache }
      : await this.generatePlan(dto, nearbyPlaces);

    const itinerary = await this.itineraryModel.create({
      user: new Types.ObjectId(user.id),
      title: `${dto.days}-day ${dto.area} itinerary`,
      area: dto.area,
      days: dto.days,
      budgetVnd: dto.budgetVnd,
      preferences: dto.preferences,
      places: nearbyPlaces.map((place) => place._id),
      plan: generated.payload,
      cacheKey,
      source: generated.source,
    });

    await this.usersService.incrementItineraryUsage(user.id);
    await this.notificationsService.create({
      recipient: user.id,
      title: 'Itinerary generated',
      message: `Your ${dto.days}-day itinerary for ${dto.area} is ready.`,
      type: NotificationType.Itinerary,
      metadata: { itineraryId: itinerary.id, source: generated.source },
    });

    return itinerary.populate(
      'places',
      'name slug category address ratingAverage location',
    );
  }

  private async findOwnedItineraryOrThrow(itineraryId: string, userId: string) {
    const itinerary = await this.itineraryModel
      .findOne({ _id: itineraryId, user: new Types.ObjectId(userId) })
      .exec();

    if (!itinerary) {
      throw new NotFoundException('Itinerary not found');
    }

    return itinerary;
  }

  private async findRelevantPlaces(dto: GenerateItineraryDto) {
    const places = await this.placesService.findAll({
      page: 1,
      limit: 12,
      q: dto.preferences.join(' '),
      longitude: dto.longitude,
      latitude: dto.latitude,
      radiusMeters: dto.radiusMeters ?? 10000,
    });

    return places as PlaceDocument[];
  }

  private async generatePlan(
    dto: GenerateItineraryDto,
    places: PlaceDocument[],
  ): Promise<{ payload: Record<string, unknown>; source: ItinerarySource }> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      return {
        payload: this.createFallbackPlan(dto, places),
        source: ItinerarySource.Fallback,
      };
    }

    const modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-1.5-flash',
    );

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(this.buildPrompt(dto, places));
      const text = result.response.text();

      return {
        payload: this.parseGeminiJson(text),
        source: ItinerarySource.Gemini,
      };
    } catch {
      if (this.configService.get('GEMINI_STRICT') === 'true') {
        throw new ServiceUnavailableException(
          'Gemini itinerary generation failed',
        );
      }

      return {
        payload: this.createFallbackPlan(dto, places),
        source: ItinerarySource.Fallback,
      };
    }
  }

  private buildPrompt(dto: GenerateItineraryDto, places: PlaceDocument[]) {
    const placeContext = places.map((place) => ({
      id: place.id,
      name: place.name,
      category: place.category,
      address: place.address,
      ratingAverage: place.ratingAverage,
    }));

    return [
      'Create a practical travel itinerary as valid JSON only.',
      `Area: ${dto.area}`,
      `Days: ${dto.days}`,
      `Budget VND: ${dto.budgetVnd}`,
      `Preferences: ${dto.preferences.join(', ')}`,
      `Candidate places: ${JSON.stringify(placeContext)}`,
      'JSON shape: {"summary": string, "days": [{"day": number, "theme": string, "items": [{"time": string, "placeName": string, "activity": string, "estimatedCostVnd": number}]}], "tips": string[]}',
    ].join('\n');
  }

  private parseGeminiJson(text: string): Record<string, unknown> {
    const cleaned = text
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    return JSON.parse(cleaned) as Record<string, unknown>;
  }

  private createFallbackPlan(
    dto: GenerateItineraryDto,
    places: PlaceDocument[],
  ): Record<string, unknown> {
    const itemsPerDay = Math.max(1, Math.ceil(places.length / dto.days));
    const days = Array.from({ length: dto.days }, (_value, index) => {
      const dayPlaces = places.slice(
        index * itemsPerDay,
        (index + 1) * itemsPerDay,
      );

      return {
        day: index + 1,
        theme: dto.preferences[index % dto.preferences.length] ?? 'Explore',
        items: dayPlaces.map((place, itemIndex) => ({
          time: itemIndex === 0 ? '09:00' : itemIndex === 1 ? '13:30' : '18:00',
          placeName: place.name,
          activity: `Visit ${place.category} spot at ${place.address}`,
          estimatedCostVnd: Math.round(dto.budgetVnd / dto.days / itemsPerDay),
        })),
      };
    });

    return {
      summary: `Suggested ${dto.days}-day itinerary for ${dto.area}.`,
      days,
      tips: [
        'Confirm opening hours before visiting.',
        'Keep travel time flexible around Hoa Lac and western Hanoi.',
      ],
    };
  }

  private createCacheKey(dto: GenerateItineraryDto) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          area: dto.area.toLowerCase(),
          days: dto.days,
          budgetVnd: dto.budgetVnd,
          preferences: [...dto.preferences].sort(),
          longitude: dto.longitude,
          latitude: dto.latitude,
          radiusMeters: dto.radiusMeters,
        }),
      )
      .digest('hex');
  }
}
