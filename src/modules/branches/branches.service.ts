import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../database/entities/branch.entity.js';
import { GuestService } from '../guest/guest.service.js';
import type { BranchView } from './branches.types.js';
import type { UpdateBranchDto } from './dto/branch.dto.js';

/** The caller's own branch = the shop's name and address. One business per deployment. */
@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    private readonly guest: GuestService,
  ) {}

  async get(branchId: string): Promise<BranchView> {
    return toView(await this.find(branchId));
  }

  async update(branchId: string, dto: UpdateBranchDto): Promise<BranchView> {
    const branch = await this.find(branchId);
    branch.name = dto.name;
    if (dto.address !== undefined) branch.address = dto.address || null;
    const saved = await this.branches.save(branch);
    // The guest menu embeds the shop name.
    await this.guest.revalidateMenuCache(branchId);
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
