import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSurveyById, getSurveyStats, getSurveyResponses, getSurveyLeaderboard, exportSurveyCSV, type Survey, type SurveyStats, type SurveyResponse, type LeaderboardEntry } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { ArrowLeft, Download, Trophy } from "lucide-react";

export default function SurveyResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;

    try {
      setLoading(true);
      const [surveyResult, statsResult, responsesResult] = await Promise.all([
        getSurveyById(id),
        getSurveyStats(id),
        getSurveyResponses(id),
      ]);

      setSurvey(surveyResult.survey);
      setStats(statsResult.stats);
      setResponses(responsesResult.responses);

      if (surveyResult.survey.type === "quiz") {
        const leaderboardResult = await getSurveyLeaderboard(id, 10);
        setLeaderboard(leaderboardResult.leaderboard);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!id) return;
    try {
      await exportSurveyCSV(id);
    } catch (error) {
      console.error("Error exporting:", error);
      alert("Error al exportar");
    }
  }

  if (loading) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!survey || !stats) {
    return <div className="p-8">No se encontró la encuesta</div>;
  }

  const isQuiz = survey.type === "quiz";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/surveys")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{survey.title}</h1>
            <p className="text-muted-foreground">{survey.description}</p>
          </div>
        </div>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Enviado a</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalSent}</div>
            <p className="text-xs text-muted-foreground">usuarios</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Respuestas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalResponses}</div>
            <p className="text-xs text-muted-foreground">{stats.responseRate.toFixed(1)}% tasa de respuesta</p>
          </CardContent>
        </Card>

        {isQuiz && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.averageScore?.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.passRate?.toFixed(1)}% aprobaron ({stats.passed}/{stats.totalResponses})
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue={isQuiz ? "overview" : "questions"}>
        <TabsList>
          {isQuiz && <TabsTrigger value="overview">Resumen</TabsTrigger>}
          <TabsTrigger value="questions">Por Pregunta</TabsTrigger>
          {isQuiz && <TabsTrigger value="leaderboard">Ranking</TabsTrigger>}
          <TabsTrigger value="responses">Respuestas Individuales</TabsTrigger>
        </TabsList>

        {isQuiz && (
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Calificaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.scoreDistribution && Object.entries(stats.scoreDistribution).map(([range, count]) => {
                  const percentage = stats.totalResponses > 0 ? (count / stats.totalResponses) * 100 : 0;
                  return (
                    <div key={range}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{range}%</span>
                        <span className="text-sm text-muted-foreground">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="questions" className="space-y-4">
          {survey.questions.map((question, index) => {
            const questionStats = stats.questionStats?.[question.id];
            if (!questionStats) return null;

            return (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>Pregunta {index + 1}</Badge>
                        {isQuiz && (
                          <Badge variant={questionStats.correctRate >= 70 ? "default" : "destructive"}>
                            {questionStats.correctRate?.toFixed(1)}% correcta
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{question.question}</CardTitle>
                      {isQuiz && question.points && (
                        <CardDescription>{question.points} puntos</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(question.type === "single_choice" || question.type === "multiple_choice") && (
                    <div className="space-y-3">
                      {Object.entries(questionStats.distribution || {}).map(([option, count]) => {
                        const countNum = Number(count);
                        const percentage = questionStats.totalAnswers > 0
                          ? (countNum / questionStats.totalAnswers) * 100
                          : 0;
                        
                        const isCorrect = isQuiz && (
                          (question.type === "single_choice" && option === question.options?.[question.correctAnswer || 0]) ||
                          (question.type === "multiple_choice" && question.correctAnswers?.some((idx) => option.includes(question.options?.[idx] || "")))
                        );

                        return (
                          <div key={option}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium flex items-center gap-2">
                                {isCorrect && <span className="text-green-600">✓</span>}
                                {option}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {countNum} ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {question.type === "rating" && (
                    <div>
                      <div className="text-3xl font-bold mb-2">
                        {questionStats.average?.toFixed(1)} ⭐
                      </div>
                      <div className="space-y-2">
                        {Object.entries(questionStats.distribution || {})
                          .sort((a, b) => Number(b[0]) - Number(a[0]))
                          .map(([rating, count]) => {
                            const countNum = Number(count);
                            const percentage = questionStats.totalAnswers > 0
                              ? (countNum / questionStats.totalAnswers) * 100
                              : 0;
                            return (
                              <div key={rating}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm">{rating} estrellas</span>
                                  <span className="text-sm text-muted-foreground">
                                    {countNum} ({percentage.toFixed(1)}%)
                                  </span>
                                </div>
                                <Progress value={percentage} className="h-2" />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {question.type === "text" && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {questionStats.textAnswers?.length || 0} respuestas de texto
                      </p>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {questionStats.textAnswers?.slice(0, 10).map((answer: string, idx: number) => (
                          <div key={idx} className="p-2 bg-muted rounded text-sm">
                            💬 {answer}
                          </div>
                        ))}
                      </div>
                      {questionStats.textAnswers && questionStats.textAnswers.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          Mostrando 10 de {questionStats.textAnswers.length} respuestas
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {isQuiz && (
          <TabsContent value="leaderboard" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Top 10 Mejores Puntajes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay participantes aún
                  </p>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.userId}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 font-bold">
                            {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                          </div>
                          <div>
                            <p className="font-medium">
                              {entry.username ? `@${entry.username}` : entry.firstName || `Usuario ${entry.userId}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Math.floor(entry.timeSpent / 60)}m {entry.timeSpent % 60}s
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{entry.percentage.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.score}/{entry.totalPoints} pts
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="responses" className="space-y-4">
          {responses.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">No hay respuestas aún</p>
              </CardContent>
            </Card>
          ) : (
            responses.map((response) => (
              <Card key={response.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {response.username ? `@${response.username}` : response.firstName || `Usuario ${response.userId}`}
                      </CardTitle>
                      <CardDescription>
                        {new Date(response.completedAt).toLocaleString()}
                        {isQuiz && response.attemptNumber && ` • Intento ${response.attemptNumber}`}
                      </CardDescription>
                    </div>
                    {isQuiz && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">{response.percentage?.toFixed(1)}%</p>
                        <Badge variant={response.passed ? "default" : "destructive"}>
                          {response.passed ? "Aprobado" : "Reprobado"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {response.answers.map((answer, idx) => {
                      const question = survey.questions.find((q) => q.id === answer.questionId);
                      if (!question) return null;

                      let answerText = "";
                      if (Array.isArray(answer.answer)) {
                        answerText = answer.answer.map((idx) => question.options?.[idx]).join(", ");
                      } else if (typeof answer.answer === "number" && question.options) {
                        answerText = question.options[answer.answer] || String(answer.answer);
                      } else {
                        answerText = String(answer.answer);
                      }

                      return (
                        <div key={answer.questionId} className="flex items-start gap-2 text-sm">
                          {isQuiz && (
                            <span className={answer.correct ? "text-green-600" : "text-red-600"}>
                              {answer.correct ? "✓" : "✗"}
                            </span>
                          )}
                          <div className="flex-1">
                            <span className="font-medium">P{idx + 1}: </span>
                            <span>{answerText}</span>
                            {isQuiz && answer.pointsEarned !== undefined && (
                              <span className="text-muted-foreground ml-2">
                                ({answer.pointsEarned}/{question.points} pts)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
