"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BadgeCheck,
  CircleDashed,
  GraduationCap,
  ListFilter,
  LogOut,
  Mail,
  Map,
  Plus,
  Send,
  Star,
  Upload,
  User,
  XCircle,
} from "lucide-react";

import { AddSchoolDialog } from "@/components/app/add-school-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { SCHOOL_STATUS_COUNTS_INVALIDATE_EVENT, type SchoolStatusCountsJson } from "@/lib/school-status-counts";
import { schoolStatusNavIconClassName } from "@/lib/school-status-ui";
import { cn } from "@/lib/utils";
import { SCHOOL_STATUSES } from "@/lib/validation/school";
import type { SchoolStatus } from "@/lib/validation/school";

const NAV = [
  { href: "/schools", label: "Schools", icon: GraduationCap },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/map", label: "Map", icon: Map },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function schoolNavActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/schools") {
    return pathname === "/schools" || pathname.startsWith("/schools/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function statusLabel(status: SchoolStatus): string {
  if (status === "None") return "No status";
  return status;
}

const STATUS_ICONS: Record<SchoolStatus, typeof Star> = {
  None: CircleDashed,
  Shortlisted: Star,
  Applying: Send,
  Accepted: BadgeCheck,
  Rejected: XCircle,
};

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const [addOpen, setAddOpen] = React.useState(false);
  const [statusCounts, setStatusCounts] = React.useState<SchoolStatusCountsJson | null>(null);
  const listStatus = searchParams.get("status") as SchoolStatus | null;
  const onSchoolList = pathname === "/schools";
  const validListStatus =
    listStatus && (SCHOOL_STATUSES as readonly string[]).includes(listStatus) ? listStatus : null;

  const closeMobileIfNeeded = () => {
    if (isMobile) setOpenMobile(false);
  };

  const fetchStatusCounts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/schools/status-counts", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SchoolStatusCountsJson;
      setStatusCounts(data);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    void fetchStatusCounts();
  }, [fetchStatusCounts, pathname]);

  React.useEffect(() => {
    const onInvalidate = () => {
      void fetchStatusCounts();
    };
    window.addEventListener(SCHOOL_STATUS_COUNTS_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(SCHOOL_STATUS_COUNTS_INVALIDATE_EVENT, onInvalidate);
  }, [fetchStatusCounts]);

  const showCountInline = isMobile || state !== "collapsed";
  const countLabel = (n: number | undefined) =>
    n === undefined ? "—" : new Intl.NumberFormat("en-US").format(n);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="data-[state=open]:bg-sidebar-accent">
              <Link href="/schools" onClick={closeMobileIfNeeded}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <GraduationCap className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">University Advisor</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">College search</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={schoolNavActive(href, pathname)} tooltip={label}>
                    <Link href={href} onClick={closeMobileIfNeeded}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Add new school" onClick={() => setAddOpen(true)}>
                  <Plus />
                  <span>Add new school</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>School list</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={onSchoolList && validListStatus == null}
                  tooltip={
                    statusCounts != null
                      ? `All schools (${countLabel(statusCounts.allSchools)})`
                      : "All schools"
                  }
                >
                  <Link
                    href="/schools"
                    onClick={closeMobileIfNeeded}
                    className="flex min-w-0 w-full items-center gap-2"
                  >
                    <ListFilter />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">All schools</span>
                      {showCountInline ? (
                        <span className="shrink-0 tabular-nums text-xs text-sidebar-foreground/60">
                          {countLabel(statusCounts?.allSchools)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {SCHOOL_STATUSES.map((status) => {
                const Icon = STATUS_ICONS[status];
                const href =
                  status === "None" ? "/schools?status=None" : `/schools?status=${encodeURIComponent(status)}`;
                const isActive = onSchoolList && validListStatus === status;
                const n = statusCounts?.byStatus[status];
                return (
                  <SidebarMenuItem key={status}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={
                        n !== undefined
                          ? `${statusLabel(status)} (${countLabel(n)})`
                          : statusLabel(status)
                      }
                    >
                      <Link
                        href={href}
                        onClick={closeMobileIfNeeded}
                        className="flex min-w-0 w-full items-center gap-2"
                      >
                        <Icon className={cn("shrink-0", schoolStatusNavIconClassName(status))} />
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate">{statusLabel(status)}</span>
                          {showCountInline ? (
                            <span className="shrink-0 tabular-nums text-xs text-sidebar-foreground/60">
                              {countLabel(n)}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                tooltip="Sign out"
                onClick={() => void signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="size-4 shrink-0" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
      <AddSchoolDialog open={addOpen} onOpenChange={setAddOpen} />
    </Sidebar>
  );
}
