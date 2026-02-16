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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
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
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
