import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import ContextPage from "./pages/ContextPage";
import DocumentsPage from "./pages/DocumentsPage";
import HistoryPage from "./pages/HistoryPage";
import UsersPage from "./pages/UsersPage";
import ActivityPage from "./pages/ActivityPage";
import LearningPage from "./pages/LearningPage";
import CategoriesPage from "./pages/CategoriesPage";
import Surveys from "./pages/Surveys";
import SurveyEditor from "./pages/SurveyEditor";
import SurveyResults from "./pages/SurveyResults";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Detectar basename dinámicamente basándose en la URL actual
const getBasename = () => {
  const pathname = window.location.pathname;
  // Si accedemos desde /botusbcali/, ese es nuestro basename
  if (pathname.startsWith('/botusbcali/') || pathname === '/botusbcali') {
    return '/botusbcali/';
  }
  // Por defecto, sin basename (localhost directo)
  return '/';
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={getBasename()}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/contexto" element={<ContextPage />} />
            <Route path="/documentos" element={<DocumentsPage />} />
            <Route path="/historial" element={<HistoryPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/actividad" element={<ActivityPage />} />
            <Route path="/aprendizaje" element={<LearningPage />} />
            <Route path="/surveys" element={<Surveys />} />
            <Route path="/surveys/new" element={<SurveyEditor />} />
            <Route path="/surveys/:id/edit" element={<SurveyEditor />} />
            <Route path="/surveys/:id/send" element={<SurveyEditor />} />
            <Route path="/surveys/:id/results" element={<SurveyResults />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
