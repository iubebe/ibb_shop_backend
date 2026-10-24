import QRCode from 'qrcode';
import { buildDynamicPayload, crc16, isVietQr, readBank } from '../vietqr.js';
import { decodeVietQr } from '../qr-decode.js';

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

/** Static VietQR for VPBank 713496669, as a banking app exports it. */
function staticPayload(): string {
  const holder = tlv('00', '970432') + tlv('01', '713496669');
  const account = tlv('00', 'A000000727') + tlv('01', holder) + tlv('02', 'QRIBFTTA');
  const body =
    tlv('00', '01') + tlv('01', '11') + tlv('38', account) + tlv('53', '704') + tlv('58', 'VN') +
    tlv('59', 'NGUYEN PHUONG') + '6304';
  return body + crc16(body);
}

describe('vietqr', () => {
  it('reads bank, account number and name from a static payload', () => {
    expect(readBank(staticPayload())).toEqual({
      bin: '970432',
      bankName: 'VPBank',
      accountNo: '713496669',
      accountName: 'NGUYEN PHUONG',
    });
  });

  it('builds a dynamic payload with amount and note and a valid CRC', () => {
    const out = buildDynamicPayload(staticPayload(), 250000, 'IBB Đơn 12AB')!;

    expect(isVietQr(out)).toBe(true);
    expect(out).toContain('010212');
    expect(out).toContain('5406250000');
    expect(out).toContain('6216' + '0812IBB Don 12AB');
    expect(out).toContain('IBB Don 12AB');
    expect(readBank(out)?.accountNo).toBe('713496669');
    expect(out.slice(-4)).toBe(crc16(out.slice(0, -4)));
  });

  it('replaces the amount of an already dynamic payload instead of duplicating it', () => {
    const once = buildDynamicPayload(staticPayload(), 1000, 'A')!;
    const twice = buildDynamicPayload(once, 2000, 'B')!;
    expect(twice.match(/54042000/g)).toHaveLength(1);
    expect(twice).not.toContain('54041000');
  });

  it('rejects non-VietQR text, a bad CRC and a non-positive amount', () => {
    expect(isVietQr('https://example.com')).toBe(false);
    expect(isVietQr(staticPayload().slice(0, -1) + '0')).toBe(false);
    expect(buildDynamicPayload(staticPayload(), 0, 'x')).toBeNull();
    expect(buildDynamicPayload('nope', 1000, 'x')).toBeNull();
  });
});

describe('decodeVietQr', () => {
  it('decodes a VietQR PNG back to its payload', async () => {
    const png = await QRCode.toBuffer(staticPayload(), { margin: 2, width: 700 });
    expect(await decodeVietQr(png)).toBe(staticPayload());
  });

  it('returns null for a QR that is not a VietQR, and for non-images', async () => {
    const png = await QRCode.toBuffer('https://example.com', { margin: 2, width: 400 });
    expect(await decodeVietQr(png)).toBeNull();
    expect(await decodeVietQr(Buffer.from('garbage'))).toBeNull();
  });
});
