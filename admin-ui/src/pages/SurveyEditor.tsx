import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createSurvey, updateSurvey, getSurveyById, sendSurvey, listUsers, type Survey, type SurveyQuestion, type UserProfile } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { PlusCircle, Trash2, Save, Send, GripVertical, X } from "lucide-react";

export default function SurveyEditor() {
  const { id, action } = useParams<{ id?: string; action?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  const [survey, setSurvey] = useState<Partial<Survey>>({
    type: "survey",
    title: "",
    description: "",
    status: "draft",
    questions: [],
    sendTo: {
      type: "all",
      userIds: [],
      filters: {},
    },
  });

  useEffect(() => {
    if (id && id !== "new") {
      loadSurvey();
    }
    loadUsers();
  }, [id]);

  async function loadSurvey() {
    try {
      setLoading(true);
      const result = await getSurveyById(id!);
      setSurvey(result.survey);
    } catch (error) {
      console.error("Error loading survey:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const users = await listUsers();
      setUsers(users);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }

  async function handleSave() {
    try {
      setLoading(true);
      if (id && id !== "new") {
        await updateSurvey(id, survey);
      } else {
        const result = await createSurvey(survey);
        navigate(`/surveys/${result.survey.id}/edit`);
      }
    } catch (error) {
      console.error("Error saving survey:", error);
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendSurvey() {
    if (!id || id === "new") {
      alert("Primero guarda la encuesta");
      return;
    }

    try {
      setLoading(true);
      const options = {
        sendToAll: survey.sendTo?.type === "all",
        userIds: survey.sendTo?.type === "specific" ? survey.sendTo.userIds : undefined,
      };
      
      const result = await sendSurvey(id, options);
      alert(`Enviado exitosamente a ${result.results.sent} usuarios${result.results.failed > 0 ? ` (${result.results.failed} fallos)` : ""}`);
      navigate("/surveys");
    } catch (error) {
      console.error("Error sending survey:", error);
      alert("Error al enviar");
    } finally {
      setLoading(false);
    }
  }

  function addQuestion() {
    const newQuestion: SurveyQuestion = {
      id: `q_${Date.now()}`,
      type: "single_choice",
      question: "",
      options: ["", ""],
      required: true,
      ...(survey.type === "quiz" && {
        correctAnswer: 0,
        points: 10,
        explanation: "",
      }),
    };

    setSurvey({
      ...survey,
      questions: [...(survey.questions || []), newQuestion],
    });
  }

  function updateQuestion(index: number, updates: Partial<SurveyQuestion>) {
    const questions = [...(survey.questions || [])];
    questions[index] = { ...questions[index], ...updates };
    setSurvey({ ...survey, questions });
  }

  function deleteQuestion(index: number) {
    const questions = [...(survey.questions || [])];
    questions.splice(index, 1);
    setSurvey({ ...survey, questions });
  }

  function addOption(questionIndex: number) {
    const questions = [...(survey.questions || [])];
    questions[questionIndex].options = [...(questions[questionIndex].options || []), ""];
    setSurvey({ ...survey, questions });
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const questions = [...(survey.questions || [])];
    const options = [...(questions[questionIndex].options || [])];
    options[optionIndex] = value;
    questions[questionIndex].options = options;
    setSurvey({ ...survey, questions });
  }

  function deleteOption(questionIndex: number, optionIndex: number) {
    const questions = [...(survey.questions || [])];
    const options = [...(questions[questionIndex].options || [])];
    options.splice(optionIndex, 1);
    questions[questionIndex].options = options;
    setSurvey({ ...survey, questions });
  }

  function toggleMultipleChoiceCorrect(questionIndex: number, optionIndex: number) {
    const questions = [...(survey.questions || [])];
    const question = questions[questionIndex];
    const correctAnswers = question.correctAnswers || [];
    
    if (correctAnswers.includes(optionIndex)) {
      question.correctAnswers = correctAnswers.filter((idx) => idx !== optionIndex);
    } else {
      question.correctAnswers = [...correctAnswers, optionIndex];
    }
    
    setSurvey({ ...survey, questions });
  }

  if (loading && id && id !== "new") {
    return <div className="p-8">Cargando...</div>;
  }

  const isQuiz = survey.type === "quiz";
  const isSending = action === "send";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {id === "new" ? "Nueva " : "Editar "} {isQuiz ? "Quiz" : "Encuesta"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/surveys")}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
          {id && id !== "new" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={loading}>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Enviar {isQuiz ? "Quiz" : "Encuesta"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿A quién deseas enviar este {isQuiz ? "quiz" : "encuesta"}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Destinatarios</Label>
                    <Select
                      value={survey.sendTo?.type || "all"}
                      onValueChange={(value) =>
                        setSurvey({
                          ...survey,
                          sendTo: { ...survey.sendTo, type: value as any},
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los usuarios ({users.length})</SelectItem>
                        <SelectItem value="specific">Usuarios específicos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {survey.sendTo?.type === "specific" && (
                    <div>
                      <Label>Seleccionar usuarios</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        {survey.sendTo.userIds?.length || 0} usuario(s) seleccionado(s)
                      </p>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                        {users.map((user) => (
                          <div key={user.chatId} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={survey.sendTo?.userIds?.includes(user.chatId) || false}
                              onChange={(e) => {
                                const userIds = survey.sendTo?.userIds || [];
                                setSurvey({
                                  ...survey,
                                  sendTo: {
                                    ...survey.sendTo,
                                    type: "specific",
                                    userIds: e.target.checked
                                      ? [...userIds, user.chatId]
                                      : userIds.filter((id) => id !== user.chatId),
                                  },
                                });
                              }}
                            />
                            <span className="text-sm">
                              {user.username ? `@${user.username}` : user.firstName || user.chatId}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSendSurvey}>Enviar Ahora</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="questions">
            Preguntas {survey.questions && survey.questions.length > 0 && (
              <Badge className="ml-2">{survey.questions.length}</Badge>
            )}
          </TabsTrigger>
          {isQuiz && <TabsTrigger value="settings">Configuración Quiz</TabsTrigger>}
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del {isQuiz ? " Quiz" : " Encuesta"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={survey.type}
                  onValueChange={(value) => setSurvey({ ...survey, type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="survey">Encuesta</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Título</Label>
                <Input
                  value={survey.title}
                  onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
                  placeholder="Ej: Satisfacción con el Bot"
                />
              </div>

              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={survey.description}
                  onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
                  placeholder="Una breve descripción..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          {survey.questions && survey.questions.length > 0 ? (
            survey.questions.map((question, qIndex) => (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <GripVertical className="w-5 h-5 text-muted-foreground mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>Pregunta {qIndex + 1}</Badge>
                          <Select
                            value={question.type}
                            onValueChange={(value) => updateQuestion(qIndex, { type: value as any })}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single_choice">Opción Única</SelectItem>
                              <SelectItem value="multiple_choice">Opción Múltiple</SelectItem>
                              <SelectItem value="rating">Calificación</SelectItem>
                              <SelectItem value="text">Texto Libre</SelectItem>
                              <SelectItem value="yes_no">Sí/No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          value={question.question}
                          onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                          placeholder="Escribe tu pregunta aquí..."
                          className="font-medium"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteQuestion(qIndex)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(question.type === "single_choice" || question.type === "multiple_choice") && (
                    <div className="space-y-2">
                      <Label>Opciones</Label>
                      {question.options?.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          {isQuiz && question.type === "single_choice" && (
                            <input
                              type="radio"
                              checked={question.correctAnswer === oIndex}
                              onChange={() => updateQuestion(qIndex, { correctAnswer: oIndex })}
                            />
                          )}
                          {isQuiz && question.type === "multiple_choice" && (
                            <input
                              type="checkbox"
                              checked={question.correctAnswers?.includes(oIndex)}
                              onChange={() => toggleMultipleChoiceCorrect(qIndex, oIndex)}
                            />
                          )}
                          <Input
                            value={option}
                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                            placeholder={`Opción ${oIndex + 1}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOption(qIndex, oIndex)}
                            disabled={(question.options?.length || 0) <= 2}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(qIndex)}
                      >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Agregar Opción
                      </Button>
                    </div>
                  )}

                  {question.type === "rating" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Mínimo</Label>
                        <Input
                          type="number"
                          value={question.min || 1}
                          onChange={(e) => updateQuestion(qIndex, { min: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Máximo</Label>
                        <Input
                          type="number"
                          value={question.max || 5}
                          onChange={(e) => updateQuestion(qIndex, { max: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}

                  {isQuiz && (
                    <>
                      <div>
                        <Label>Puntos</Label>
                        <Input
                          type="number"
                          value={question.points || 10}
                          onChange={(e) => updateQuestion(qIndex, { points: parseInt(e.target.value) })}
                        />
                      </div>

                      <div>
                        <Label>Explicación (opcional)</Label>
                        <Textarea
                          value={question.explanation || ""}
                          onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
                          placeholder="Explica por qué esta es la respuesta correcta..."
                          rows={2}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={question.required}
                      onCheckedChange={(checked) => updateQuestion(qIndex, { required: checked })}
                    />
                    <Label>Pregunta obligatoria</Label>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground mb-4">
                  No hay preguntas aún
                </p>
                <div className="flex justify-center">
                  <Button onClick={addQuestion}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Agregar Primera Pregunta
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {survey.questions && survey.questions.length > 0 && (
            <Button onClick={addQuestion} variant="outline" className="w-full">
              <PlusCircle className="w-4 h-4 mr-2" />
              Agregar Pregunta
            </Button>
          )}
        </TabsContent>

        {isQuiz && (
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Quiz</CardTitle>
                <CardDescription>Personaliza el comportamiento del quiz</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Porcentaje de aprobación (%)</Label>
                  <Input
                    type="number"
                    value={survey.quizSettings?.passingScore || 70}
                    onChange={(e) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          passingScore: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Número máximo de intentos</Label>
                  <Input
                    type="number"
                    value={survey.quizSettings?.maxAttempts || 3}
                    onChange={(e) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          maxAttempts: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Límite de tiempo (minutos, 0 = sin límite)</Label>
                  <Input
                    type="number"
                    value={survey.quizSettings?.timeLimit ? survey.quizSettings.timeLimit / 60 : 0}
                    onChange={(e) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          timeLimit: parseInt(e.target.value) * 60 || null,
                        },
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={survey.quizSettings?.showCorrectAnswers !== false}
                    onCheckedChange={(checked) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          showCorrectAnswers: checked,
                        },
                      })
                    }
                  />
                  <Label>Mostrar respuestas correctas</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={survey.quizSettings?.showExplanations !== false}
                    onCheckedChange={(checked) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          showExplanations: checked,
                        },
                      })
                    }
                  />
                  <Label>Mostrar explicaciones</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={survey.quizSettings?.showLeaderboard !== false}
                    onCheckedChange={(checked) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          showLeaderboard: checked,
                        },
                      })
                    }
                  />
                  <Label>Mostrar ranking/leaderboard</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={survey.quizSettings?.randomizeQuestions || false}
                    onCheckedChange={(checked) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          randomizeQuestions: checked,
                        },
                      })
                    }
                  />
                  <Label>Aleatorizar orden de preguntas</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={survey.quizSettings?.randomizeOptions || false}
                    onCheckedChange={(checked) =>
                      setSurvey({
                        ...survey,
                        quizSettings: {
                          ...(survey.quizSettings || {} as any),
                          randomizeOptions: checked,
                        },
                      })
                    }
                  />
                  <Label>Aleatorizar opciones de respuesta</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
