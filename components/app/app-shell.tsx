"use client";

import * as React from "react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function AppSidebarFallback() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <SidebarMenuSkeleton showIcon />
      </SidebarHeader>
      <SidebarContent className="gap-2 px-2 pt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SidebarMenuSkeleton key={i} showIcon />
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebarFallback />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 sm:px-6 lg:pl-8 lg:pr-8">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <span className="text-sm text-muted-foreground">University Advisor</span>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-10 pt-0 sm:px-6 lg:pl-8 lg:pr-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
