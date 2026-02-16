const AppFooter = () => {
  return (
    <footer className="border-t border-border bg-white py-6 px-6 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Bot Facultad de Ingeniería. Todos los derechos reservados.
        </p>
        <p className="text-xs text-muted-foreground">
          Desarrollado <span className="font-semibold text-primary">By GHS</span>
        </p>
      </div>
    </footer>
  );
};

export default AppFooter;
