import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, ipInAnyCidr, ipInCidr, parseIp } from "@/lib/cidr";
import { computeCheckinFlags } from "@/lib/flags";

describe("parseIp", () => {
  it("parses IPv4 and IPv6", () => {
    expect(parseIp("10.0.0.1")).toEqual({ version: 4, value: BigInt(0x0a000001) });
    expect(parseIp("::1")?.version).toBe(6);
    expect(parseIp("2001:db8::1")?.version).toBe(6);
    expect(parseIp("[2001:db8::1]")?.version).toBe(6);
  });
  it("treats IPv4-mapped IPv6 as IPv4", () => {
    expect(parseIp("::ffff:192.168.1.5")).toEqual(parseIp("192.168.1.5"));
    expect(parseIp("::ffff:c0a8:105")).toEqual(parseIp("192.168.1.5"));
  });
  it("rejects garbage", () => {
    for (const bad of ["", "256.1.1.1", "1.2.3", "1.2.3.4.5", "abc", "1::2::3", "12345::", "fe80::1::"]) {
      expect(parseIp(bad)).toBeNull();
    }
  });
});

describe("ipInCidr", () => {
  it("matches IPv4 ranges", () => {
    expect(ipInCidr("10.1.2.3", "10.0.0.0/8")).toBe(true);
    expect(ipInCidr("11.1.2.3", "10.0.0.0/8")).toBe(false);
    expect(ipInCidr("192.168.1.255", "192.168.1.0/24")).toBe(true);
    expect(ipInCidr("192.168.2.0", "192.168.1.0/24")).toBe(false);
    expect(ipInCidr("203.0.113.7", "203.0.113.7/32")).toBe(true);
    expect(ipInCidr("203.0.113.7", "203.0.113.7")).toBe(true);
    expect(ipInCidr("203.0.113.8", "203.0.113.7")).toBe(false);
    expect(ipInCidr("8.8.8.8", "0.0.0.0/0")).toBe(true);
    expect(ipInCidr("172.20.0.1", "172.16.0.0/12")).toBe(true);
    expect(ipInCidr("172.32.0.1", "172.16.0.0/12")).toBe(false);
  });
  it("matches IPv6 ranges", () => {
    expect(ipInCidr("2001:db8:abcd::42", "2001:db8::/32")).toBe(true);
    expect(ipInCidr("2001:db9::1", "2001:db8::/32")).toBe(false);
    expect(ipInCidr("::1", "::1/128")).toBe(true);
  });
  it("matches mapped IPv4 against IPv4 ranges", () => {
    expect(ipInCidr("::ffff:10.0.0.5", "10.0.0.0/24")).toBe(true);
  });
  it("never matches across families or with bad prefixes", () => {
    expect(ipInCidr("10.0.0.1", "::/0")).toBe(false);
    expect(ipInCidr("10.0.0.1", "10.0.0.0/33")).toBe(false);
    expect(ipInCidr("10.0.0.1", "10.0.0.0/x")).toBe(false);
    expect(ipInCidr("bogus", "10.0.0.0/8")).toBe(false);
  });
  it("ipInAnyCidr", () => {
    expect(ipInAnyCidr("192.168.0.9", ["10.0.0.0/8", "192.168.0.0/16"])).toBe(true);
    expect(ipInAnyCidr("1.1.1.1", ["10.0.0.0/8", "192.168.0.0/16"])).toBe(false);
    expect(ipInAnyCidr(null, ["10.0.0.0/8"])).toBe(false);
  });
});

describe("clientIpFromHeaders", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("203.0.113.1");
  });
  it("falls back to x-real-ip", () => {
    expect(clientIpFromHeaders(h({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFromHeaders(h({}))).toBeNull();
  });
});

describe("computeCheckinFlags", () => {
  it("flags off-network only when ranges are configured", () => {
    const base = { deviceId: "d1", deviceUsedByOtherStudent: false };
    expect(computeCheckinFlags({ ...base, ip: "1.2.3.4", schoolIpRanges: [] })).toEqual([]);
    expect(computeCheckinFlags({ ...base, ip: "1.2.3.4", schoolIpRanges: ["10.0.0.0/8"] })).toEqual(["off_network"]);
    expect(computeCheckinFlags({ ...base, ip: "10.2.3.4", schoolIpRanges: ["10.0.0.0/8"] })).toEqual([]);
    expect(computeCheckinFlags({ ...base, ip: null, schoolIpRanges: ["10.0.0.0/8"] })).toEqual(["off_network"]);
  });
  it("flags shared devices", () => {
    expect(
      computeCheckinFlags({ ip: null, schoolIpRanges: [], deviceId: "d1", deviceUsedByOtherStudent: true }),
    ).toEqual(["shared_device"]);
    expect(
      computeCheckinFlags({ ip: null, schoolIpRanges: [], deviceId: null, deviceUsedByOtherStudent: false }),
    ).toEqual(["no_device"]);
  });
});
