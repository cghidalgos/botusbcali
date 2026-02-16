import logoBot from "@/assets/logoBot.png";

const BotHeader = () => {
  return (
    <header className="py-8 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-2">
        Operación
      </p>
      <div className="flex items-center justify-center gap-4 mb-3">
        <img src={logoBot} alt="Bot Facultad de Ingeniería" className="w-16 h-16 object-contain" />
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Bot de la Facultad de Ingeniería
        </h1>
      </div>
      <p className="text-muted-foreground max-w-xl mx-auto">
        Define en qué contexto responde, sube documentos complementarios y sigue el pulso…
      </p>
    </header>
  );
};

export default BotHeader;
