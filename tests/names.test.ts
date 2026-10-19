import { describe, expect, it } from "vitest";
import { displayName, firstName, firstNameLastInitial } from "@/lib/names";

const student = (name: string | null, email = "someone@x.org") => ({ name, email, role: "student" });

describe("displayName", () => {
  it("shows students as first name + last initial", () => {
    expect(displayName(student("Ben Ortiz"))).toBe("Ben O.");
    expect(displayName(student("  ada   park "))).toBe("ada P.");
  });
  it("handles single-word names", () => {
    expect(displayName(student("Cher"))).toBe("Cher");
  });
  it("handles multi-part names and suffixes", () => {
    expect(displayName(student("Mary Ann Smith"))).toBe("Mary S.");
    expect(displayName(student("Juan Carlos de la Cruz"))).toBe("Juan C.");
    expect(displayName(student("Martin Luther King Jr."))).toBe("Martin K.");
    expect(displayName(student("Henry Ford III"))).toBe("Henry F.");
    expect(displayName(student("Ana Smith-Jones"))).toBe("Ana S.");
    expect(displayName(student("Zoë Ångström"))).toBe("Zoë Å.");
    expect(displayName(student("Sam O'Neil"))).toBe("Sam O.");
  });
  it("falls back to the email local part, never the full email", () => {
    expect(displayName(student(null, "ben.ortiz@school.org"))).toBe("Ben O.");
    expect(displayName(student("", "grace_hopper42@school.org"))).toBe("Grace H.");
    expect(displayName(student("   ", "kid@school.org"))).toBe("Kid");
    expect(displayName(student(null, "1234@school.org"))).toBe("Student");
    expect(displayName(student(null, "ben.ortiz@school.org"))).not.toContain("@");
  });
  it("keeps full names for mentors and admins", () => {
    expect(displayName({ name: "Coach Lee", email: "c@x.org", role: "mentor" })).toBe("Coach Lee");
    expect(displayName({ name: "Pat Admin Person", email: "a@x.org", role: "admin" })).toBe("Pat Admin Person");
    expect(displayName({ name: null, email: "a@x.org", role: "admin" })).toBe("a@x.org");
  });
  it("firstName", () => {
    expect(firstName(student("Ben Ortiz"))).toBe("Ben");
    expect(firstName(student(null, "ada.park@x.org"))).toBe("Ada");
    expect(firstNameLastInitial("")).toBe("");
  });
});
