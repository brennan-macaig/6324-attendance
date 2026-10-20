import { getCurrentUser, hasRole } from "@/lib/authz";
import { displayName } from "@/lib/names";
import { NavBar, type NavLink } from "./nav-bar";

export async function Nav() {
  const user = await getCurrentUser().catch(() => null);
  const team = process.env.TEAM_NAME || "FRC Team";
  const links: NavLink[] = [];
  if (user) {
    links.push({ href: "/me", label: "Me", icon: "me" });
    links.push({ href: "/dashboard", label: hasRole(user, "mentor") ? "Dashboard" : "Who's here", icon: hasRole(user, "mentor") ? "dashboard" : "people" });
    if (hasRole(user, "mentor")) {
      links.push({ href: "/kiosk", label: "Kiosk", icon: "kiosk" });
      links.push({ href: "/admin/meetings", label: "Meetings", icon: "meetings" });
      links.push({ href: "/admin/hours", label: "Hours", icon: "hours", also: ["/admin/students"] });
    }
    if (hasRole(user, "admin")) {
      links.push({ href: "/admin/roster", label: "Roster", icon: "roster" });
      links.push({ href: "/admin/seasons", label: "Seasons", icon: "seasons" });
      links.push({ href: "/admin/settings", label: "Settings", icon: "settings" });
    }
  }
  return (
    <NavBar
      team={team}
      links={links}
      user={user ? { name: displayName(user), email: user.email, role: user.role, image: user.image } : null}
    />
  );
}
