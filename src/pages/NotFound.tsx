const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
    <h1 className="text-6xl font-black mb-2">404</h1>
    <p className="text-muted-foreground mb-6">Página não encontrada</p>
    <a href="/upload" className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all">
      Ir para Upload
    </a>
  </div>
);

export default NotFound;
