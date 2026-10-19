import { Link } from '@tanstack/react-router';
import { FileTextIcon, GitCompareArrowsIcon, Settings2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { to: '/', label: 'Documentos', icon: FileTextIcon },
  { to: '/presets', label: 'Presets', icon: Settings2Icon },
  { to: '/compare', label: 'Comparar', icon: GitCompareArrowsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex flex-col px-2 py-1 group-data-[collapsible=icon]:hidden">
            <span className="font-heading font-semibold">Descomplica AI</span>
            <span className="text-xs text-muted-foreground">Simplificador de documentos jurídicos</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <Link
                        to={item.to}
                        activeOptions={{ exact: item.to === '/' }}
                        activeProps={{ 'data-active': true }}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">Prova de conceito acadêmica — não é orientação jurídica</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
