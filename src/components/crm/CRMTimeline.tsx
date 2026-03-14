import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, ChevronRight } from "lucide-react";
import { EVENT_LABELS } from "@/lib/crm-pipeline-engine";

interface UserEvent {
  id: string;
  created_at: string;
  event_type: string;
  event_data: any;
}

interface VisitorSession {
  id: string;
  fullId: string;
  events: UserEvent[];
  duration: number;
  device: string;
  origin: string;
  eventCount: number;
  firstSeen: number;
}

interface CRMTimelineProps {
  visitorSessions: VisitorSession[];
  selectedSession: string | null;
  onSelectSession: (sessionId: string | null) => void;
}

export function CRMTimeline({ visitorSessions, selectedSession, onSelectSession }: CRMTimelineProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2">
        🎬 Replays de Sessão
        <span className="text-xs text-muted-foreground font-normal">({visitorSessions.length} sessões)</span>
      </h3>
      <p className="text-xs text-muted-foreground">
        Visualize a jornada completa de cada visitante: scroll, cliques, tempo entre ações.
      </p>

      {selectedSession ? (
        <div className="space-y-3">
          <button onClick={() => onSelectSession(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            ← Voltar para lista
          </button>
          {(() => {
            const session = visitorSessions.find(s => s.fullId === selectedSession);
            if (!session) return <p className="text-sm text-muted-foreground">Sessão não encontrada</p>;
            return (
              <div className="bg-card border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold">Sessão: {session.id}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      {session.device} · {session.origin} · Duração: {session.duration}s · {session.eventCount} eventos
                    </p>
                  </div>
                </div>

                {/* Event Timeline Player */}
                <div className="space-y-0">
                  {session.events.map((e, i) => {
                    const cfg = EVENT_LABELS[e.event_type];
                    const prevTime = i > 0 ? new Date(session.events[i - 1].created_at).getTime() : new Date(e.created_at).getTime();
                    const currTime = new Date(e.created_at).getTime();
                    const gap = Math.round((currTime - prevTime) / 1000);
                    const colorCls = cfg?.color || "bg-muted text-muted-foreground";

                    let detail = "";
                    if (e.event_type === "scroll_depth" || e.event_type === "scroll_milestone") detail = `Scroll: ${e.event_data?.percent || 0}%`;
                    if (e.event_type === "click_position") detail = `Seção: ${e.event_data?.section || "—"} · Elemento: ${e.event_data?.element_text || e.event_data?.element || "—"}`;
                    if (e.event_type === "click_buy_button") detail = "Clicou em comprar";

                    return (
                      <div key={i}>
                        {i > 0 && gap > 0 && (
                          <div className="flex items-center gap-2 pl-6 py-1">
                            <div className="w-px h-4 bg-border" />
                            <span className="text-[9px] text-muted-foreground">+{gap}s</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 py-1.5">
                          <div className={`h-7 w-7 rounded-full ${colorCls.split(" ")[0]} flex items-center justify-center flex-shrink-0`}>
                            <Eye className={`h-3.5 w-3.5 ${colorCls.split(" ")[1]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold">{cfg?.label || e.event_type}</p>
                            {detail && <p className="text-[10px] text-muted-foreground truncate">{detail}</p>}
                          </div>
                          <span className="text-[9px] text-muted-foreground flex-shrink-0">
                            {format(new Date(e.created_at), "HH:mm:ss", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-1.5">
          {visitorSessions.length === 0 ? (
            <div className="bg-muted/50 border rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma sessão com interações suficientes</p>
            </div>
          ) : (
            visitorSessions.map(s => (
              <div
                key={s.fullId}
                onClick={() => onSelectSession(s.fullId)}
                className="bg-card border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Eye className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold font-mono">{s.id}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.device} · {s.origin} · {s.eventCount} eventos · {s.duration}s
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(s.firstSeen), { addSuffix: true, locale: ptBR })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
