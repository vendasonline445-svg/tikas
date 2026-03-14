import { 
  LayoutDashboard, Users, Contact, Activity, Package, Megaphone, 
  TrendingUp, Sparkles, Settings, Bug, Plug, 
  ChevronDown, ChevronLeft, ChevronRight, Sun, Moon, LogOut, BarChart3, 
  MousePointerClick, Link2, Eye, Layers, 
  Zap, FileText, Server, Building2, Code2, Upload,
  Heart, ShoppingCart, Gauge, Bell, Signal, Lightbulb,
  PieChart, GitBranch, DollarSign, Crosshair, LayoutList,
  Workflow, RefreshCcw, Wallet, Target, LineChart, ClipboardList,
  ScanSearch, Radio, MousePointer, Globe, ShieldCheck
} from "lucide-react";
import FunnelIQLogo from "@/components/FunnelIQLogo";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

export type AdminTab = 
  | "dashboard" | "funnel-health" | "live-activity"
  | "tracking" | "tracking-sessions" | "tracking-clicks" | "tracking-links" | "tracking-debug"
  | "campaigns" | "campaigns-creatives" | "campaigns-performance" | "campaigns-automation" | "campaigns-budgets"
  | "analytics" | "analytics-attribution" | "analytics-revenue" | "analytics-reports"
  | "ai" | "ai-insights"
  | "settings-tracking" | "settings-pixels" | "settings-integrations" | "settings-admin"
  | "clients" | "clients-bc" | "tiktok" | "tracking-pixels" | "tracking-config" | "settings-scripts" | "logs" | "settings-csv"
  | "superadmin";

interface NavItem {
  tab: AdminTab;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  separator?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
    items: [
      { tab: "dashboard", label: "Overview", icon: <Gauge className="h-3.5 w-3.5" /> },
      { tab: "live-activity", label: "Live Activity", icon: <Signal className="h-3.5 w-3.5" /> },
      { tab: "funnel-health", label: "Funnel Health", icon: <Heart className="h-3.5 w-3.5" /> },
    ],
  },
  {
    key: "tracking",
    label: "Tracking",
    icon: <Activity className="h-[18px] w-[18px]" />,
    items: [
      { tab: "tracking", label: "Events", icon: <Activity className="h-3.5 w-3.5" /> },
      { tab: "tracking-sessions", label: "Sessions", icon: <Eye className="h-3.5 w-3.5" /> },
      { tab: "tracking-clicks", label: "Clicks", icon: <MousePointerClick className="h-3.5 w-3.5" /> },
      { tab: "tracking-links", label: "Tracked Links", icon: <Link2 className="h-3.5 w-3.5" /> },
      { tab: "tracking-debug", label: "Debug", icon: <Bug className="h-3.5 w-3.5" /> },
    ],
  },
  {
    key: "campaigns",
    label: "Campaigns",
    icon: <Megaphone className="h-[18px] w-[18px]" />,
    items: [
      { tab: "campaigns", label: "Campaigns", icon: <Target className="h-3.5 w-3.5" /> },
      { tab: "campaigns-creatives", label: "Creatives", icon: <Layers className="h-3.5 w-3.5" /> },
      { tab: "campaigns-performance", label: "Performance", icon: <TrendingUp className="h-3.5 w-3.5" /> },
      { tab: "campaigns-automation", label: "Automation", icon: <Zap className="h-3.5 w-3.5" /> },
      { tab: "campaigns-budgets", label: "Budgets", icon: <Wallet className="h-3.5 w-3.5" /> },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: <BarChart3 className="h-[18px] w-[18px]" />,
    items: [
      { tab: "analytics", label: "Overview", icon: <PieChart className="h-3.5 w-3.5" /> },
      { tab: "analytics-attribution", label: "Attribution", icon: <GitBranch className="h-3.5 w-3.5" /> },
      { tab: "analytics-revenue", label: "Revenue", icon: <DollarSign className="h-3.5 w-3.5" /> },
      { tab: "analytics-reports", label: "Reports", icon: <ClipboardList className="h-3.5 w-3.5" /> },
    ],
  },
  {
    key: "ai",
    label: "AI",
    icon: <Sparkles className="h-[18px] w-[18px]" />,
    items: [
      { tab: "ai", label: "Diagnosis", icon: <ScanSearch className="h-3.5 w-3.5" /> },
      { tab: "ai-insights", label: "Insights", icon: <Lightbulb className="h-3.5 w-3.5" /> },
    ],
    separator: true,
  },
  {
    key: "settings",
    label: "Settings",
    icon: <Settings className="h-[18px] w-[18px]" />,
    items: [
      { tab: "settings-tracking", label: "Tracking", icon: <Activity className="h-3.5 w-3.5" /> },
      { tab: "settings-pixels", label: "Pixels", icon: <Radio className="h-3.5 w-3.5" /> },
      { tab: "settings-integrations", label: "Integrações", icon: <Plug className="h-3.5 w-3.5" /> },
      { tab: "settings-admin", label: "Administração", icon: <Building2 className="h-3.5 w-3.5" /> },
    ],
  },
];

function getGroupForTab(tab: AdminTab): string {
  if (tab === "superadmin") return "superadmin";
  for (const g of NAV_GROUPS) {
    if (g.items.some(i => i.tab === tab)) return g.key;
  }
  return "dashboard";
}

interface AdminSidebarProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onExportCSV: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function AdminSidebar({
  currentTab, onTabChange, onExportCSV, darkMode, onToggleDarkMode, onLogout, collapsed, onToggleCollapse
}: AdminSidebarProps) {
  const { isSuperAdmin, isAdmin, profile, signOut } = useAuth();
  const isClient = profile?.role === "client";

  // Build filtered nav groups based on role
  const filteredGroups = NAV_GROUPS.filter(g => {
    if (isClient && !["dashboard"].includes(g.key)) return false;
    return true;
  });

  // Add Super Admin group for superadmins
  const allGroups = isSuperAdmin
    ? [...filteredGroups, {
        key: "superadmin",
        label: "Super Admin",
        icon: <ShieldCheck className="h-[18px] w-[18px]" />,
        items: [{ tab: "superadmin" as AdminTab, label: "Gerenciar Acessos", icon: <ShieldCheck className="h-3.5 w-3.5" /> }],
        separator: false,
      } as NavGroup]
    : filteredGroups;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    return new Set([getGroupForTab(currentTab)]);
  });

  useEffect(() => {
    const group = getGroupForTab(currentTab);
    setExpandedGroups(prev => {
      if (prev.has(group)) return prev;
      return new Set(prev).add(group);
    });
  }, [currentTab]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleTabClick = (tab: AdminTab, groupKey: string) => {
    onTabChange(tab);
    setExpandedGroups(prev => new Set(prev).add(groupKey));
  };

  const separatorIdx = allGroups.findIndex(g => g.separator);
  const mainGroups = separatorIdx >= 0 ? allGroups.slice(0, separatorIdx + 1) : allGroups;
  const settingsGroups = separatorIdx >= 0 ? allGroups.slice(separatorIdx + 1) : [];

  const renderGroup = (group: NavGroup) => {
    const isExpanded = expandedGroups.has(group.key);
    const isActive = group.items.some(i => i.tab === currentTab);

    if (collapsed) {
      return (
        <Tooltip key={group.key} delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleTabClick(group.items[0].tab, group.key)}
              className={cn(
                "w-full h-9 rounded-md flex items-center justify-center transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
              )}
            >
              {group.icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p className="text-xs font-medium">{group.label}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div key={group.key}>
        <button
          onClick={() => toggleGroup(group.key)}
          className={cn(
            "w-full h-8 rounded-md flex items-center gap-2.5 px-2.5 text-[13px] font-medium transition-all duration-150 group",
            isActive
              ? "text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
          )}
        >
          <span className={cn(
            "flex items-center justify-center w-5 h-5 rounded transition-colors",
            isActive && "text-primary"
          )}>
            {group.icon}
          </span>
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown className={cn(
            "h-3 w-3 text-muted-foreground/50 transition-transform duration-200",
            isExpanded && "rotate-180"
          )} />
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="ml-[22px] pl-2.5 border-l border-border/40 mt-0.5 space-y-px py-0.5">
            {group.items.map(item => (
              <button
                key={item.tab}
                onClick={() => handleTabClick(item.tab, group.key)}
                className={cn(
                  "w-full h-7 rounded-md flex items-center gap-2 px-2 text-xs transition-all duration-150",
                  currentTab === item.tab
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className={cn(
      "h-screen sticky top-0 flex flex-col bg-card border-r border-border/60 transition-all duration-300 z-40 select-none",
      collapsed ? "w-[52px]" : "w-[230px]"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center h-12 border-b border-border/60 shrink-0",
        collapsed ? "justify-center px-1" : "px-3 justify-between"
      )}>
        {!collapsed && <FunnelIQLogo size={22} showText />}
        {collapsed && <FunnelIQLogo size={22} />}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground",
            collapsed && "hidden"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5 scrollbar-thin">
        {mainGroups.map(renderGroup)}

        {settingsGroups.length > 0 && (
          <div className="py-2">
            <div className="h-px bg-border/60 mx-1" />
          </div>
        )}

        {settingsGroups.map(renderGroup)}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-border/60 shrink-0",
        collapsed ? "p-1 space-y-0.5" : "p-1.5 space-y-1.5"
      )}>
        {/* User info */}
        {!collapsed && profile && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
              {profile.full_name?.[0] ?? profile.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile.full_name ?? "Usuário"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
            </div>
          </div>
        )}

        {!collapsed && (
          <a
            href="/funil-admin"
            className="block text-xs text-muted-foreground hover:text-foreground transition-colors px-2 mb-2"
          >
            Painel Operacional Mesa Dobrável →
          </a>
        )}

        <div className={cn("flex gap-0.5", collapsed ? "flex-col" : "")}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleDarkMode}
                className={cn(
                  "h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground transition-colors",
                  collapsed ? "w-full" : "flex-1"
                )}
              >
                {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"} sideOffset={8}>
              <p className="text-xs">{darkMode ? "Light mode" : "Dark mode"}</p>
            </TooltipContent>
          </Tooltip>

          {collapsed && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="w-full h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="text-xs">Expand sidebar</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => { signOut(); onLogout(); }}
                className={cn(
                  "h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
                  collapsed ? "w-full" : "flex-1"
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"} sideOffset={8}>
              <p className="text-xs">Logout</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
