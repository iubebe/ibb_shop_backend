import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import QRCode from 'qrcode';
import { TablesService } from '../tables.service.js';

function build(
  opts: { found?: unknown; clash?: unknown; rows?: unknown[]; wifi?: unknown } = {},
) {
  const tables = {
    find: vi.fn().mockResolvedValue(opts.rows ?? []),
    findOneBy: vi.fn((where: { id?: string; name?: unknown }) =>
      Promise.resolve(where.name ? (opts.clash ?? null) : (opts.found ?? null)),
    ),
    create: vi.fn((v: object) => v),
    save: vi.fn((v: object) =>
      Promise.resolve({ id: 't1', createdAt: new Date(0), ...v }),
    ),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const config = { get: vi.fn().mockReturnValue('https://guest.test/') };
  const wifi = { getActiveQr: vi.fn().mockResolvedValue(opts.wifi ?? null) };
  return {
    service: new TablesService(tables as never, config as never, wifi as never),
    tables,
    wifi,
  };
}

describe('TablesService', () => {
  it('creates a table with a fresh url-safe token in the caller branch', async () => {
    const { service, tables } = build();
    const created = await service.create('b1', { name: 'Table 1' });
    expect(tables.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b1', name: 'Table 1' }),
    );
    expect(created.qrToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it('409s on a duplicate name, but allows keeping the same table name', async () => {
    const { service } = build({ clash: { id: 'other' } });
    await expect(service.create('b1', { name: 'T' })).rejects.toBeInstanceOf(ConflictException);
    const same = build({ found: { id: 't1', name: 'Old' }, clash: { id: 't1' } });
    await expect(same.service.update('b1', 't1', { name: 'OLD' })).resolves.toMatchObject({ name: 'OLD' });
  });

  it('404s for a table outside the branch', async () => {
    const { service } = build();
    await expect(service.update('b1', 'x', { name: 'A' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.regenerateToken('b1', 'x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('b1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('regenerating replaces the token', async () => {
    const { service } = build({ found: { id: 't1', name: 'A', qrToken: 'old' } });
    const view = await service.regenerateToken('b1', 't1');
    expect(view.qrToken).not.toBe('old');
  });

  it('refuses to print when there are no tables', async () => {
    const { service } = build();
    await expect(service.qrPdf('b1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renders a multi-page PDF', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, name: `Table ${i}`, qrToken: `tok${i}` }));
    const { service } = build({ rows });
    const pdf = await service.qrPdf('b1', { columns: 1, rows: 2 });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(3);
  });

  it('prints the table name and, when a WiFi network is active, its QR below the table QR', async () => {
    const png = await QRCode.toBuffer('WIFI:T:WPA;S:cafe;P:secret123;;');
    const rows = [{ id: 't1', name: 'Bàn Ế 1', qrToken: 'tok1' }];
    const { service, wifi } = build({ rows, wifi: { ssid: 'cafe', png } });
    const withWifi = await service.qrPdf('b1', {});
    expect(wifi.getActiveQr).toHaveBeenCalledWith('b1');
    expect(withWifi.subarray(0, 5).toString()).toBe('%PDF-');
    const images = (pdf: Buffer) => pdf.toString('latin1').match(/\/Subtype \/Image/g)!.length;

    const { service: plain } = build({ rows });
    const without = await plain.qrPdf('b1', {});
    // table QR + WiFi QR instead of the table QR alone
    expect(images(withWifi)).toBe(images(without) * 2);
  });
});
