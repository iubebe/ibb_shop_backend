import jsQRModule from 'jsqr';
import sharp from 'sharp';
import { isVietQr } from './vietqr.js';

// jsqr is CJS: under NodeNext the default import is the module namespace, not the function.
const jsQR = ((jsQRModule as { default?: unknown }).default ?? jsQRModule) as typeof jsQRModule.default;

/** Resolutions to try: jsQR is sensitive to scale, and screenshots are often very large. */
const WIDTHS = [1000, 600, 1600];

/**
 * Reads the QR in an uploaded image and returns its text only if it is a VietQR payload,
 * so a null result means "keep showing the static image". Never throws.
 */
export async function decodeVietQr(image: Buffer): Promise<string | null> {
  for (const width of WIDTHS) {
    try {
      const { data, info } = await sharp(image)
        .rotate()
        .resize({ width })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const found = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (found && isVietQr(found.data)) return found.data.trim();
    } catch {
      // unreadable at this size; try the next one
    }
  }
  return null;
}
