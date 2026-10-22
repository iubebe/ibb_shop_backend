import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WifiSecurity } from '../../../database/enums.js';
import { buildWifiPayload } from '../wifi-payload.js';
import { WifiService } from '../wifi.service.js';

function build(found: unknown = null) {
  const networks = {
    find: vi.fn().mockResolvedValue([]),
    findOneBy: vi.fn().mockResolvedValue(found),
    save: vi.fn((v: object) => Promise.resolve({ id: 'w1', createdAt: new Date(0), updatedAt: new Date(0), ...v })),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const manager = {
    update: vi.fn().mockResolvedValue(undefined),
    create: vi.fn((_: unknown, v: object) => v),
    save: vi.fn((v: object) => Promise.resolve({ id: 'w1', createdAt: new Date(0), updatedAt: new Date(0), ...v })),
  };
  const dataSource = { transaction: vi.fn((fn: (m: typeof manager) => unknown) => fn(manager)) };
  const s3 = {
    ensureBucket: vi.fn().mockResolvedValue(false),
    upload: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    download: vi.fn(),
  };
  const logger = { setContext: vi.fn(), warn: vi.fn() };
  const service = new WifiService(networks as never, dataSource as never, s3 as never, logger as never);
  return { service, networks, manager, s3 };
}

const dto = { ssid: 'Cafe', security: WifiSecurity.WPA, password: 'hunter2hunter2' };

describe('buildWifiPayload', () => {
  it('escapes delimiters and omits the password for open networks', () => {
    expect(buildWifiPayload({ ...dto, ssid: 'a;b:c', password: 'p\\w"d,', hidden: true })).toBe(
      'WIFI:T:WPA;S:a\\;b\\:c;P:p\\\\w\\"d\\,;H:true;;',
    );
    expect(buildWifiPayload({ ssid: 'Open', security: WifiSecurity.OPEN, hidden: false })).toBe(
      'WIFI:T:nopass;S:Open;;',
    );
  });
});

describe('WifiService', () => {
  it('stores the QR privately, makes it the active network and never persists the password', async () => {
    const { service, manager, s3 } = build();
    const created = await service.create('b1', dto);

    expect(s3.ensureBucket).toHaveBeenCalledWith('wifi-qr');
    expect(s3.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^b1\/.+\.png$/),
      expect.any(Buffer),
      expect.objectContaining({ bucket: 'wifi-qr', contentType: 'image/png' }),
    );
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { branchId: 'b1', isActive: true }, { isActive: false });
    expect(JSON.stringify([manager.create.mock.calls, created])).not.toContain(dto.password);
    expect(created).toMatchObject({ ssid: 'Cafe', isActive: true });
    expect(created).not.toHaveProperty('imagePath');
  });

  it.each([
    [{ ...dto, password: 'short' }],
    [{ ...dto, security: WifiSecurity.WEP, password: 'sixsix' }],
    [{ ...dto, security: WifiSecurity.OPEN }],
    [{ ...dto, ssid: 'é'.repeat(17) }],
  ])('rejects credentials a phone could not use (%j)', async (bad) => {
    const { service, s3 } = build();
    await expect(service.create('b1', bad)).rejects.toBeInstanceOf(BadRequestException);
    expect(s3.upload).not.toHaveBeenCalled();
  });

  it('removes the uploaded object again when the row write fails', async () => {
    const { service, manager, s3 } = build();
    manager.save.mockRejectedValueOnce(new Error('db down'));
    await expect(service.create('b1', dto)).rejects.toThrow('db down');
    expect(s3.delete).toHaveBeenCalledWith(expect.stringMatching(/^b1\//), 'wifi-qr');
  });

  it('rotating swaps the image and deletes the old one', async () => {
    const { service, s3 } = build({ id: 'w1', branchId: 'b1', imagePath: 'b1/old.png', isActive: true });
    await service.replaceCredentials('b1', 'w1', dto);
    expect(s3.delete).toHaveBeenCalledWith('b1/old.png', 'wifi-qr');
  });

  it('is scoped to the branch', async () => {
    const { service } = build();
    await expect(service.getImage('b1', 'x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setActive('b1', 'x', true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('b1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns null for the PDF when no network is active', async () => {
    const { service } = build();
    await expect(service.getActiveQr('b1')).resolves.toBeNull();
  });
});
