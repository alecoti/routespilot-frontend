import {
  BarChart3,
  Gauge,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavKey = "history" | "usage" | "settings" | "adminMetrics";

export const navItems: Array<{
  href: string;
  icon: LucideIcon;
  key: NavKey;
  label: string;
}> = [
  { href: "/history", icon: History, key: "history", label: "History" },
  { href: "/usage", icon: BarChart3, key: "usage", label: "Usage" },
  { href: "/settings", icon: Settings, key: "settings", label: "Settings" },
];

export const adminNavItems: Array<{
  href: string;
  icon: LucideIcon;
  key: NavKey;
  label: string;
}> = [
  {
    href: "/admin/metrics",
    icon: Gauge,
    key: "adminMetrics",
    label: "Admin metrics",
  },
];
