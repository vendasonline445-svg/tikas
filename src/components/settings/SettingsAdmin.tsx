import { useState } from "react";
import AdminClientHub from "@/components/AdminClientHub";
import { Building2, Server, Upload } from "lucide-react";

type SubTab = "clientes" | "business_centers" | "logs" | "csv";

interface Props {
  defaultTab?: string;
}

export default function SettingsAdmin({ defaultTab }: Props) {
  const initial: SubTab = defaultTab === "business_centers" ? "business_centers"
    : defaultTab === "logs" ? "logs"
    : defaultTab === "csv" ? "csv"
    : "clientes";
  
  const [subTab, setSubTab] = useState<SubTab>(initial);

  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: "clientes", label: "Clientes", icon: Building2 },
    { id: "business_centers", label: "Business Centers", icon: Building2 },
    { id: "logs", label: "API Logs", icon: Server },
    { id: "csv", label: "CSV Import", icon: Upload },
  ];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Administração</h1>
        <p className="text-sm text-muted-foreground">Gestão operacional do sistema</p>
      </div>

      <div className="flex gap-1 border-b border-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              subTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <AdminClientHub key={subTab} defaultTab={subTab === "business_centers" ? "business_centers" : "clientes"} />
    </div>
  );
}
