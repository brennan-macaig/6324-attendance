/**
 * Minimal IPv4/IPv6 CIDR matching (no dependencies). IPv4-mapped IPv6
 * addresses (::ffff:1.2.3.4) are treated as IPv4.
 */

type Parsed = { version: 4 | 6; value: bigint };

function parseIPv4(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let v = BigInt(0);
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    v = (v << BigInt(8)) | BigInt(n);
  }
  return v;
}

function parseIPv6(ip: string): bigint | null {
  let addr = ip;
  const zone = addr.indexOf("%");
  if (zone !== -1) addr = addr.slice(0, zone);
  // Embedded IPv4 tail (e.g. ::ffff:1.2.3.4) -> rewrite as two hex groups.
  if (addr.includes(".")) {
    const lastColon = addr.lastIndexOf(":");
    if (lastColon === -1) return null;
    const v4 = parseIPv4(addr.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = Number(v4 >> BigInt(16)).toString(16);
    const lo = Number(v4 & BigInt(0xffff)).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = toGroups(halves[0]);
  let groups: string[];
  if (halves.length === 2) {
    const rest = toGroups(halves[1]);
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...Array<string>(fill).fill("0"), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  let v = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    v = (v << BigInt(16)) | BigInt(parseInt(g, 16));
  }
  return v;
}

const V4_MAPPED_PREFIX = BigInt("0xffff00000000");
const V4_MASK = BigInt("0xffffffff");

export function parseIp(ip: string): Parsed | null {
  const s = ip.trim().replace(/^\[|\]$/g, "");
  if (!s) return null;
  if (!s.includes(":")) {
    const v = parseIPv4(s);
    return v === null ? null : { version: 4, value: v };
  }
  const v = parseIPv6(s);
  if (v === null) return null;
  // IPv4-mapped (::ffff:a.b.c.d)
  if (v >> BigInt(32) === V4_MAPPED_PREFIX >> BigInt(32)) {
    return { version: 4, value: v & V4_MASK };
  }
  return { version: 6, value: v };
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const addr = parseIp(ip);
  if (!addr) return false;
  const [base, prefixStr] = cidr.trim().split("/");
  const net = parseIp(base);
  if (!net || net.version !== addr.version) return false;
  const bits = net.version === 4 ? 32 : 128;
  const prefix = prefixStr === undefined ? bits : Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;
  if (prefix === 0) return true;
  const shift = BigInt(bits - prefix);
  return addr.value >> shift === net.value >> shift;
}

export function ipInAnyCidr(ip: string | null | undefined, cidrs: string[]): boolean {
  if (!ip) return false;
  return cidrs.some((c) => ipInCidr(ip, c));
}

/** First address in X-Forwarded-For (the client as seen by Vercel's edge). */
export function clientIpFromHeaders(h: { get(name: string): string | null }): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || null;
}
