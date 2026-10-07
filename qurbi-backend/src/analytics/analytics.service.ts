import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  BulkListing,
  BuyerActivity,
  BuyerActivityTargetType,
  BuyerActivityType,
  Livestock,
  User,
  UserRole,
} from '../entities';
import { TrackBuyerActivityDto } from './dto/track-buyer-activity.dto';

const VIEW_DEDUPE_MINUTES = 30;

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(BuyerActivity)
    private readonly activityRepository: Repository<BuyerActivity>,
    @InjectRepository(Livestock)
    private readonly livestockRepository: Repository<Livestock>,
    @InjectRepository(BulkListing)
    private readonly bulkListingRepository: Repository<BulkListing>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async track(
    viewer: AuthenticatedUser | undefined,
    dto: TrackBuyerActivityDto,
  ): Promise<void> {
    const isFarmView = dto.eventType === BuyerActivityType.FARMER_PROFILE_VIEW;
    const targetsFarm = dto.targetType === BuyerActivityTargetType.FARMER;
    if (isFarmView !== targetsFarm) {
      throw new BadRequestException('Activity type does not match its target');
    }
    const target = await this.resolveTarget(dto.targetType, dto.targetId);

    // A farmer opening their own listing should not inflate buyer demand.
    if (viewer?.id === target.farmerId) return;

    if (
      dto.eventType === BuyerActivityType.LISTING_VIEW ||
      dto.eventType === BuyerActivityType.FARMER_PROFILE_VIEW
    ) {
      const since = new Date(Date.now() - VIEW_DEDUPE_MINUTES * 60_000);
      const identity = viewer?.id
        ? { viewerUserId: viewer.id }
        : dto.sessionId
          ? { sessionId: dto.sessionId }
          : null;
      if (identity) {
        const duplicate = await this.activityRepository.findOne({
          where: {
            eventType: dto.eventType,
            targetType: dto.targetType,
            targetId: dto.targetId,
            createdAt: MoreThan(since),
            ...identity,
          },
          select: { id: true },
        });
        if (duplicate) return;
      }
    }

    await this.activityRepository.save(
      this.activityRepository.create({
        farmerId: target.farmerId,
        viewerUserId: viewer?.id ?? null,
        eventType: dto.eventType,
        targetType: dto.targetType,
        targetId: dto.targetId,
        sessionId: dto.sessionId?.trim() || null,
        source: dto.source?.trim() || null,
      }),
    );

    // Keep the legacy livestock counter useful while the event table carries
    // the richer, time-based data used by the Analytics page.
    if (
      dto.eventType === BuyerActivityType.LISTING_VIEW &&
      dto.targetType === BuyerActivityTargetType.LIVESTOCK
    ) {
      await this.livestockRepository.increment({ id: dto.targetId }, 'viewCount', 1);
    }
  }

  async farmerSummary(farmerId: string, days: number) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    const base = () =>
      this.activityRepository
        .createQueryBuilder('activity')
        .where('activity.farmerId = :farmerId', { farmerId })
        .andWhere('activity.createdAt >= :from', { from });

    const [totalsRows, uniqueRow, dailyRows, topRows, recent] = await Promise.all([
      base()
        .select('activity.eventType', 'eventType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('activity.eventType')
        .getRawMany<{ eventType: BuyerActivityType; count: string }>(),
      base()
        .select(
          'COUNT(DISTINCT COALESCE(activity.viewerUserId, activity.sessionId, activity.id))',
          'count',
        )
        .getRawOne<{ count: string }>(),
      base()
        .select('DATE(activity.createdAt)', 'date')
        .addSelect(
          `SUM(CASE WHEN activity.eventType = '${BuyerActivityType.LISTING_VIEW}' THEN 1 ELSE 0 END)`,
          'views',
        )
        .addSelect(
          `SUM(CASE WHEN activity.eventType = '${BuyerActivityType.ADD_TO_CART}' THEN 1 ELSE 0 END)`,
          'addToCart',
        )
        .addSelect(
          `SUM(CASE WHEN activity.eventType = '${BuyerActivityType.BUY_NOW}' THEN 1 ELSE 0 END)`,
          'buyNow',
        )
        .groupBy('DATE(activity.createdAt)')
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; views: string; addToCart: string; buyNow: string }>(),
      base()
        .andWhere('activity.targetType IN (:...types)', {
          types: [
            BuyerActivityTargetType.LIVESTOCK,
            BuyerActivityTargetType.BULK_LISTING,
          ],
        })
        .select('activity.targetType', 'targetType')
        .addSelect('activity.targetId', 'targetId')
        .addSelect(
          `SUM(CASE WHEN activity.eventType = '${BuyerActivityType.LISTING_VIEW}' THEN 1 ELSE 0 END)`,
          'views',
        )
        .addSelect(
          `SUM(CASE WHEN activity.eventType = '${BuyerActivityType.ADD_TO_CART}' THEN 1 ELSE 0 END)`,
          'addToCart',
        )
        .addSelect(
          `SUM(CASE WHEN activity.eventType = '${BuyerActivityType.BUY_NOW}' THEN 1 ELSE 0 END)`,
          'buyNow',
        )
        .groupBy('activity.targetType')
        .addGroupBy('activity.targetId')
        .orderBy('views', 'DESC')
        .addOrderBy('addToCart', 'DESC')
        .limit(8)
        .getRawMany<{
          targetType: BuyerActivityTargetType;
          targetId: string;
          views: string;
          addToCart: string;
          buyNow: string;
        }>(),
      this.activityRepository.find({
        where: { farmerId, createdAt: MoreThan(from) },
        order: { createdAt: 'DESC' },
        take: 12,
        select: {
          id: true,
          eventType: true,
          targetType: true,
          targetId: true,
          viewerUserId: true,
          source: true,
          createdAt: true,
        },
      }),
    ]);

    const counts = Object.fromEntries(
      totalsRows.map((row) => [row.eventType, Number(row.count)]),
    ) as Partial<Record<BuyerActivityType, number>>;
    const listingViews = counts[BuyerActivityType.LISTING_VIEW] || 0;
    const addToCart = counts[BuyerActivityType.ADD_TO_CART] || 0;
    const buyNow = counts[BuyerActivityType.BUY_NOW] || 0;
    const farmerProfileViews = counts[BuyerActivityType.FARMER_PROFILE_VIEW] || 0;

    const targets = await this.targetDetails(farmerId, [
      ...topRows.map((row) => ({ type: row.targetType, id: row.targetId })),
      ...recent.map((row) => ({ type: row.targetType, id: row.targetId })),
    ]);

    const dailyByDate = new Map(
      dailyRows.map((row) => [
        String(row.date),
        {
          date: String(row.date),
          views: Number(row.views),
          addToCart: Number(row.addToCart),
          buyNow: Number(row.buyNow),
        },
      ]),
    );

    return {
      range: { days, from: from.toISOString(), to: new Date().toISOString() },
      totals: {
        listingViews,
        uniqueVisitors: Number(uniqueRow?.count || 0),
        addToCart,
        buyNow,
        farmerProfileViews,
        viewToCartRate: percent(addToCart, listingViews),
        viewToBuyRate: percent(buyNow, listingViews),
      },
      daily: dateKeys(from, days).map(
        (date) => dailyByDate.get(date) || { date, views: 0, addToCart: 0, buyNow: 0 },
      ),
      topListings: topRows.map((row) => ({
        targetType: row.targetType,
        targetId: row.targetId,
        ...targets.get(`${row.targetType}:${row.targetId}`),
        views: Number(row.views),
        addToCart: Number(row.addToCart),
        buyNow: Number(row.buyNow),
      })),
      recentActivity: recent.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        targetType: row.targetType,
        targetId: row.targetId,
        ...targets.get(`${row.targetType}:${row.targetId}`),
        visitorType: row.viewerUserId ? 'signed_in' : 'guest',
        source: row.source,
        occurredAt: row.createdAt,
      })),
    };
  }

  private async resolveTarget(
    targetType: BuyerActivityTargetType,
    targetId: string,
  ): Promise<{ farmerId: string }> {
    if (targetType === BuyerActivityTargetType.LIVESTOCK) {
      const row = await this.livestockRepository.findOne({
        where: { id: targetId },
        select: { id: true, farmerId: true },
      });
      if (row) return row;
    }
    if (targetType === BuyerActivityTargetType.BULK_LISTING) {
      const row = await this.bulkListingRepository.findOne({
        where: { id: targetId },
        select: { id: true, farmerId: true },
      });
      if (row) return row;
    }
    if (targetType === BuyerActivityTargetType.FARMER) {
      const farmer = await this.userRepository.findOne({
        where: { id: targetId, role: UserRole.FARMER },
        select: { id: true },
      });
      if (farmer) return { farmerId: farmer.id };
    }
    throw new NotFoundException('Analytics target not found');
  }

  private async targetDetails(
    farmerId: string,
    targets: { type: BuyerActivityTargetType; id: string }[],
  ): Promise<Map<string, { title: string; image: string | null }>> {
    const livestockIds = uniqueIds(
      targets.filter((row) => row.type === BuyerActivityTargetType.LIVESTOCK),
    );
    const bulkIds = uniqueIds(
      targets.filter((row) => row.type === BuyerActivityTargetType.BULK_LISTING),
    );
    const livestockPromise: Promise<Livestock[]> = livestockIds.length
        ? this.livestockRepository
            .createQueryBuilder('listing')
            .where('listing.farmerId = :farmerId', { farmerId })
            .andWhere('listing.id IN (:...ids)', { ids: livestockIds })
            .select(['listing.id', 'listing.title', 'listing.images'])
            .getMany()
        : Promise.resolve([]);
    const bulkPromise: Promise<BulkListing[]> = bulkIds.length
        ? this.bulkListingRepository
            .createQueryBuilder('listing')
            .where('listing.farmerId = :farmerId', { farmerId })
            .andWhere('listing.id IN (:...ids)', { ids: bulkIds })
            .select(['listing.id', 'listing.title', 'listing.images'])
            .getMany()
        : Promise.resolve([]);
    const [livestock, bulk] = await Promise.all([livestockPromise, bulkPromise]);
    const result = new Map<string, { title: string; image: string | null }>();
    livestock.forEach((row) =>
      result.set(`${BuyerActivityTargetType.LIVESTOCK}:${row.id}`, {
        title: row.title,
        image: row.images?.[0] || null,
      }),
    );
    bulk.forEach((row) =>
      result.set(`${BuyerActivityTargetType.BULK_LISTING}:${row.id}`, {
        title: row.title,
        image: row.images?.[0] || null,
      }),
    );
    return result;
  }
}

function uniqueIds(rows: { id: string }[]): string[] {
  return [...new Set(rows.map((row) => row.id))];
}

function percent(numerator: number, denominator: number): number {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function dateKeys(from: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}
