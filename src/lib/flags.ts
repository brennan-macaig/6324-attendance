import { ipInAnyCidr } from "./cidr";

/**
 * Check-in flags are advisory signals for mentors to review, never hard blocks.
 */
export const FLAG = {
  offNetwork: "off_network",
  sharedDevice: "shared_device",
  autoCheckout: "auto_checkout",
  /** Still checked in at the daily cutoff (DAILY_CHECKOUT_TIME, default 9:00 PM). */
  autoCheckout9pm: "auto_checkout_9pm",
  manual: "manual",
  edited: "edited",
  selfCheckout: "self_checkout",
  noDevice: "no_device",
} as const;

export type Flag = (typeof FLAG)[keyof typeof FLAG];

export const FLAG_LABELS: Record<string, string> = {
  off_network: "Off school network",
  shared_device: "Shared device",
  auto_checkout: "Auto checkout at meeting close",
  auto_checkout_9pm: "Auto checkout at daily cutoff",
  manual: "Added manually",
  edited: "Times edited by admin",
  self_checkout: "Checked out from phone without scanning",
  no_device: "No device cookie",
};

export function computeCheckinFlags(input: {
  ip: string | null;
  schoolIpRanges: string[];
  deviceId: string | null;
  deviceUsedByOtherStudent: boolean;
}): Flag[] {
  const flags: Flag[] = [];
  if (input.schoolIpRanges.length > 0 && !ipInAnyCidr(input.ip, input.schoolIpRanges)) {
    flags.push(FLAG.offNetwork);
  }
  if (!input.deviceId) flags.push(FLAG.noDevice);
  else if (input.deviceUsedByOtherStudent) flags.push(FLAG.sharedDevice);
  return flags;
}

export function addFlag(flags: readonly string[], flag: string): string[] {
  return flags.includes(flag) ? [...flags] : [...flags, flag];
}
