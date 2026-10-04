/**
 * Client IP for a raw handshake (WebSocket). With `hops` trusted proxies in
 * front, the client is the `hops`-th entry from the right of
 * `X-Forwarded-For`; entries further left are client-controlled and ignored.
 * Matches what Express does for `req.ip` with `trust proxy = hops`.
 */
export function clientIpFromHandshake(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  hops: number,
): string {
  const direct = remoteAddress ?? 'unknown';
  if (hops <= 0) return direct;
  const header = Array.isArray(forwardedFor)
    ? forwardedFor.join(',')
    : forwardedFor;
  const chain = (header ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  // the last hop's address is `remoteAddress`; earlier hops are in the header
  chain.push(direct);
  return chain[Math.max(chain.length - 1 - hops, 0)] ?? direct;
}
