import { MessageSquare, FileText, Clock, Activity, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import logoBot from "@/assets/logoBot.png";

const sections = [
  {
    title: "Contexto de conversación",
    description: "Define el prompt base, notas adicionales y plantillas que guían las respuestas del bot.",
    icon: MessageSquare,
    to: "/contexto",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Documentos de referencia",
    description: "Sube archivos, URLs, páginas web o texto plano como base de conocimiento.",
    icon: FileText,
    to: "/documentos",
    color: "bg-accent/10 text-accent",
  },
  {
    title: "Historial Q&A",
    description: "Revisa todas las preguntas y respuestas procesadas por el bot.",
    icon: Clock,
    to: "/historial",
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Actividad",
    description: "Monitorea en tiempo real los eventos y operaciones del sistema.",
    icon: Activity,
    to: "/actividad",
    color: "bg-yellow-50 text-yellow-600",
  },
];

const Index = () => {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4 py-8">
        <img src={logoBot} alt="Bot" className="w-20 h-20 mx-auto object-contain" />
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Bot de la Facultad de Ingeniería
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Administra el contexto, los documentos de referencia y monitorea la actividad de tu asistente inteligente desde un solo lugar.
        </p>
      </div>

      {/* Section Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="panel group hover:shadow-lg hover:border-primary/20 transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {s.description}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Index;
