import { useState } from "react";
import CategoriesPanel from "@/components/CategoriesPanel";
import FAQPanel from "@/components/FAQPanel";
import { Tags, MessageSquare } from "lucide-react";

const CategoriesPage = () => {
  const [activeTab, setActiveTab] = useState<"categories" | "faqs">("faqs");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestión de categorías y FAQs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra las categorías del sistema y las preguntas frecuentes cacheadas automáticamente.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("faqs")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "faqs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Preguntas Frecuentes (Cache)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "categories"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tags className="w-4 h-4" />
          Categorías Sugeridas
        </button>
      </div>

      {/* Content */}
      {activeTab === "faqs" ? <FAQPanel /> : <CategoriesPanel />}
    </div>
  );
};

export default CategoriesPage;
