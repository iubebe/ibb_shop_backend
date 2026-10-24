/** VietQR (NAPAS 247) payloads follow EMVCo TLV: 2-digit tag, 2-digit length, value. */

const NAPAS_GUID = 'A000000727';

/** Napas BIN -> short bank name, for the line printed under the QR. */
const BANKS: Record<string, string> = {
  '970403': 'Sacombank',
  '970405': 'Agribank',
  '970407': 'Techcombank',
  '970415': 'VietinBank',
  '970416': 'ACB',
  '970418': 'BIDV',
  '970419': 'NCB',
  '970422': 'MB',
  '970423': 'TPBank',
  '970426': 'MSB',
  '970428': 'Nam A Bank',
  '970431': 'Eximbank',
  '970432': 'VPBank',
  '970436': 'Vietcombank',
  '970437': 'HDBank',
  '970441': 'VIB',
  '970443': 'SHB',
  '970448': 'OCB',
  '970449': 'LPBank',
  '970440': 'SeABank',
};

export interface VietQrBank {
  bin: string;
  bankName: string;
  accountNo: string;
  /** Tag 59 when the source QR carries one. */
  accountName: string | null;
}

interface Tlv {
  tag: string;
  value: string;
}

function parseTlv(data: string): Tlv[] | null {
  const out: Tlv[] = [];
  let i = 0;
  while (i < data.length) {
    if (i + 4 > data.length) return null;
    const tag = data.slice(i, i + 2);
    const len = Number(data.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len)) return null;
    if (i + 4 + len > data.length) return null;
    out.push({ tag, value: data.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

function encode(items: Tlv[]): string {
  return items.map(({ tag, value }) => `${tag}${String(value.length).padStart(2, '0')}${value}`).join('');
}

/** CRC-16/CCITT-FALSE over the payload up to and including the "6304" prefix. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

interface Parsed {
  items: Tlv[];
  account: Tlv;
}

/** Valid only when the CRC matches and tag 38 is a NAPAS 247 account (not a card, MoMo, ZaloPay...). */
function parse(payload: string): Parsed | null {
  const text = payload.trim();
  if (text.length < 20 || !text.startsWith('000201')) return null;
  if (crc16(text.slice(0, -4)) !== text.slice(-4).toUpperCase()) return null;
  const items = parseTlv(text);
  if (!items) return null;
  const account = items.find((t) => t.tag === '38');
  if (!account) return null;
  const inner = parseTlv(account.value);
  if (inner?.find((t) => t.tag === '00')?.value !== NAPAS_GUID) return null;
  return { items, account };
}

export function isVietQr(payload: string): boolean {
  return parse(payload) !== null;
}

/** Bank, account number and (when present) account name of a VietQR payload. */
export function readBank(payload: string): VietQrBank | null {
  const parsed = parse(payload);
  if (!parsed) return null;
  const inner = parseTlv(parsed.account.value) ?? [];
  const holder = parseTlv(inner.find((t) => t.tag === '01')?.value ?? '') ?? [];
  const bin = holder.find((t) => t.tag === '00')?.value;
  const accountNo = holder.find((t) => t.tag === '01')?.value;
  if (!bin || !accountNo) return null;
  const name = parsed.items.find((t) => t.tag === '59')?.value.trim();
  return { bin, bankName: BANKS[bin] ?? bin, accountNo, accountName: name || null };
}

/** Banks reject accents and long text in the transfer note. */
function sanitizeMemo(memo: string): string {
  return memo
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, 25);
}

/**
 * Turns a stored (usually static) VietQR payload into a dynamic one for `amount` VND:
 * initiation method 12, tag 54 amount, tag 62/08 transfer note, fresh CRC.
 */
export function buildDynamicPayload(payload: string, amount: number, memo: string): string | null {
  const parsed = parse(payload);
  if (!parsed || !Number.isInteger(amount) || amount <= 0) return null;
  const note = sanitizeMemo(memo);

  const items = parsed.items.filter((t) => !['01', '54', '62', '63'].includes(t.tag));
  items.push({ tag: '01', value: '12' }, { tag: '54', value: String(amount) });
  if (note) items.push({ tag: '62', value: encode([{ tag: '08', value: note }]) });
  items.sort((a, b) => Number(a.tag) - Number(b.tag));

  const body = `${encode(items)}6304`;
  return body + crc16(body);
}
