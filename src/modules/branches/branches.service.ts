import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REDIS_KEY } from '../../constants/redis-key.constants.js';
import { Branch } from '../../database/entities/branch.entity.js';
import { RedisService } from '../../redis/redis.service.js';
import { GuestService } from '../guest/guest.service.js';
import type { BranchView } from './branches.types.js';
import type { UpdateBranchDto } from './dto/branch.dto.js';

/** Public shop name cache TTL: 30 minutes (also dropped on rename). */
const PUBLIC_NAME_CACHE_TTL_SECONDS = 30 * 60;

/** The caller's own branch = the shop's name and address. One business per deployment. */
@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    private readonly guest: GuestService,
    private readonly redis: RedisService,
  ) {}

  async get(branchId: string): Promise<BranchView> {
    return toView(await this.find(branchId));
  }

  /** One business per deployment, so the oldest branch is the shop. Name only: no address or id. */
  async getPublicName(): Promise<{ name: string }> {
    const cached = await this.redis.getJson<{ name: string }>(REDIS_KEY.BRANCH_PUBLIC_NAME);
    if (cached) return cached;

    const [branch] = await this.branches.find({ order: { updatedAt: 'DESC' }, take: 1 });
    if (!branch) throw new NotFoundException('Branch not found');
    const view = { name: branch.name };
    await this.redis.setJson(REDIS_KEY.BRANCH_PUBLIC_NAME, view, PUBLIC_NAME_CACHE_TTL_SECONDS);
    return view;
  }

  async update(branchId: string, dto: UpdateBranchDto): Promise<BranchView> {
    const branch = await this.find(branchId);
    branch.name = dto.name;
    if (dto.address !== undefined) branch.address = dto.address || null;
    const saved = await this.branches.save(branch);
    // The guest menu and the public name both embed the shop name.
    await this.guest.revalidateMenuCache(branchId);
    await this.redis.del(REDIS_KEY.BRANCH_PUBLIC_NAME);
    return toView(saved);
  }

  private async find(branchId: string): Promise<Branch> {
    const branch = await this.branches.findOneBy({ id: branchId });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }
}

function toView(b: Branch): BranchView {
  return { id: b.id, name: b.name, address: b.address };
}
