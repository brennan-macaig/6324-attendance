import type { Tone } from "@/components/ui";
import { meetingTypeEnum, type MeetingType } from "@/db/schema";

export const MEETING_TYPES: { id: MeetingType; label: string; tone: Tone }[] = [
  { id: "regular", label: "Regular meeting", tone: "neutral" },
  { id: "competition", label: "Competition", tone: "accent" },
  { id: "outreach", label: "Outreach event", tone: "success" },
];

export function meetingTypeInfo(type: MeetingType) {
  return MEETING_TYPES.find((t) => t.id === type) ?? MEETING_TYPES[0];
}

export function isMeetingType(value: unknown): value is MeetingType {
  return (meetingTypeEnum.enumValues as readonly string[]).includes(value as string);
}
