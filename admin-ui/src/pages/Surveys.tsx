import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSurveys, deleteSurvey, type Survey } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { PlusCircle, FileText, GraduationCap, BarChart3, Trash2, Pencil, Send } from "lucide-react";

export default function Surveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "survey" | "quiz">("all");
  const navigate = useNavigate();

  useEffect(() => {
    loadSurveys();
  }, [filter]);

  async function loadSurveys() {
    try {
      setLoading(true);
      const filters = filter !== "all" ? { type: filter } : undefined;
      const result = await getSurveys(filters);
      setSurveys(result.surveys);
    } catch (error) {
      console.error("Error loading surveys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSurvey(id);
      loadSurveys();
    } catch (error) {
      console.error("Error deleting survey:", error);
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      active: "default",
      closed: "outline",
      scheduled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status.toUpperCase()}</Badge>;
  }

  function getTypeBadge(type: string) {
    return type === "quiz" ? (
      <Badge variant="default" className="bg-purple-600">
        <GraduationCap className="w-3 h-3 mr-1" />
        Quiz
      </Badge>
    ) : (
      <Badge variant="default" className="bg-blue-600">
        <FileText className="w-3 h-3 mr-1" />
        Encuesta
      </Badge>
    );
  }

  const filteredSurveys = surveys;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Encuestas y Quizzes</h1>
          <p className="text-muted-foreground">Gestiona encuestas de feedback y quizzes educativos</p>
        </div>
        <Button onClick={() => navigate("/surveys/new")}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Crear Nuevo
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="survey">Encuestas</TabsTrigger>
          <TabsTrigger value="quiz">Quizzes</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4 mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Cargando...</p>
              </CardContent>
            </Card>
          ) : filteredSurveys.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No hay {filter === "all" ? "elementos" : filter === "quiz" ? "quizzes" : "encuestas"} aún
                </p>
                <div className="flex justify-center mt-4">
                  <Button onClick={() => navigate("/surveys/new")}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Crear {filter === "quiz" ? "Quiz" : "Encuesta"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredSurveys.map((survey) => (
              <Card key={survey.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        {getTypeBadge(survey.type)}
                        {getStatusBadge(survey.status)}
                      </div>
                      <CardTitle className="text-xl">{survey.title}</CardTitle>
                      {survey.description && (
                        <CardDescription>{survey.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Preguntas</p>
                      <p className="text-2xl font-bold">{survey.questions.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Enviado a</p>
                      <p className="text-2xl font-bold">{survey.sentCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Respuestas</p>
                      <p className="text-2xl font-bold">{survey.responseCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tasa de respuesta</p>
                      <p className="text-2xl font-bold">
                        {survey.sentCount > 0
                          ? `${((survey.responseCount / survey.sentCount) * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {survey.type === "quiz" && survey.quizSettings && (
                    <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                      <span>✅ Aprobación: {survey.quizSettings.passingScore}%</span>
                      <span>
                        🔄 Intentos: {survey.quizSettings.maxAttempts === 1 ? "Único" : survey.quizSettings.maxAttempts}
                      </span>
                      {survey.quizSettings.timeLimit && (
                        <span>⏱️ Tiempo: {Math.floor(survey.quizSettings.timeLimit / 60)}min</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {survey.responseCount > 0 && (
                      <Button variant="default" size="sm" asChild>
                        <Link to={`/surveys/${survey.id}/results`}>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Ver Resultados
                        </Link>
                      </Button>
                    )}

                    {survey.status === "draft" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/surveys/${survey.id}/edit`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Link>
                      </Button>
                    )}

                    {(survey.status === "draft" || survey.status === "active") && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/surveys/${survey.id}/send`}>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar
                        </Link>
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará permanentemente la {survey.type === "quiz" ? "quiz" : "encuesta"} y todas
                            sus respuestas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(survey.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
