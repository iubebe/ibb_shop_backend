import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentQrCodesService } from '../payment-qr-codes.service.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

function build(existing: any = null) {
  const repo = {
    find: vi.fn().mockResolvedValue([]),
    findOneBy: vi.fn().mockResolvedValue(existing),
    create: vi.fn((data: unknown) => ({ ...(data as object) })),
    save: vi.fn(async (data: any) => ({ id: 'qr1', isActive: true, ...data })),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const s3 = {
    upload: vi.fn(async (key: string) => ({ key, url: `https://media.example/${key}` })),
    delete: vi.fn().mockResolvedValue(undefined),
    keyFromPublicUrl: vi.fn((url: string) => (url.startsWith('https://media.example/') ? url.slice('https://media.example/'.length) : null)),
  };
  const service = new PaymentQrCodesService(repo as never, s3 as never);
  return { service, repo, s3 };
}

describe('PaymentQrCodesService.create', () => {
  it('uploads the image under the branch and saves an active row pointing at the URL', async () => {
    const ctx = build();

    const saved = await ctx.service.create('b1', 'MoMo', JPEG);

    expect(ctx.s3.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^payment-qr\/b1\/[0-9a-f-]+\.jpg$/),
      JPEG,
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
    expect(saved).toMatchObject({
      branchId: 'b1',
      label: 'MoMo',
      isActive: true,
      imagePath: expect.stringMatching(/^https:\/\/media\.example\/payment-qr\/b1\//),
    });
  });

  it('sniffs the bytes, so a PNG named .jpg is stored as PNG', async () => {
    const ctx = build();
    await ctx.service.create('b1', 'Bank', PNG);
    expect(ctx.s3.upload.mock.calls[0][0]).toMatch(/\.png$/);
  });

  it('rejects a non-image without touching storage', async () => {
    const ctx = build();
    await expect(ctx.service.create('b1', 'X', Buffer.from('hello'))).rejects.toThrow(BadRequestException);
    expect(ctx.s3.upload).not.toHaveBeenCalled();
  });

  it('deletes the uploaded object when the row cannot be saved', async () => {
    const ctx = build();
    ctx.repo.save.mockRejectedValueOnce(new Error('db down'));

    await expect(ctx.service.create('b1', 'MoMo', JPEG)).rejects.toThrow('db down');
    expect(ctx.s3.delete).toHaveBeenCalledWith(ctx.s3.upload.mock.calls[0][0]);
  });
});

describe('PaymentQrCodesService.update', () => {
  it('changes only the fields that were sent', async () => {
    const ctx = build({ id: 'qr1', branchId: 'b1', label: 'Old', isActive: true, imagePath: 'u' });

    const updated = await ctx.service.update('b1', 'qr1', { isActive: false });

    expect(updated).toMatchObject({ label: 'Old', isActive: false });
  });

  it('404s for a code in another branch', async () => {
    const ctx = build(null);
    await expect(ctx.service.update('b2', 'qr1', { label: 'x' })).rejects.toThrow(NotFoundException);
    expect(ctx.repo.findOneBy).toHaveBeenCalledWith({ id: 'qr1', branchId: 'b2' });
  });
});

describe('PaymentQrCodesService.replaceImage', () => {
  it('stores the new image and deletes the old object', async () => {
    const ctx = build({ id: 'qr1', branchId: 'b1', label: 'MoMo', isActive: true, imagePath: 'https://media.example/payment-qr/b1/old.png' });

    const saved = await ctx.service.replaceImage('b1', 'qr1', JPEG);

    expect(saved.imagePath).toMatch(/\.jpg$/);
    expect(ctx.s3.delete).toHaveBeenCalledWith('payment-qr/b1/old.png');
  });
});

describe('PaymentQrCodesService.remove', () => {
  it('removes the row and its S3 object', async () => {
    const ctx = build({ id: 'qr1', branchId: 'b1', imagePath: 'https://media.example/payment-qr/b1/a.jpg' });

    await ctx.service.remove('b1', 'qr1');

    expect(ctx.repo.remove).toHaveBeenCalled();
    expect(ctx.s3.delete).toHaveBeenCalledWith('payment-qr/b1/a.jpg');
  });

  it('404s when the code does not exist', async () => {
    const ctx = build(null);
    await expect(ctx.service.remove('b1', 'missing')).rejects.toThrow(NotFoundException);
    expect(ctx.repo.remove).not.toHaveBeenCalled();
  });
});
