import { useState, useRef, useCallback } from "react";
import { Upload, Film, CheckCircle2, AlertCircle, X, Loader2, Copy, Tv, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import NavBar from "@/components/NavBar";

const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/avi"];

const STREAM_URL = "https://tv.opendata.center/stream";

type UploadState = "idle" | "validating" | "confirm" | "uploading" | "success" | "error";

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const UploadPage = () => {
  const [dragOver, setDragOver] = useState(false);
  const [videoFile, setVideoFile] = useState<{ file: File; preview: string; size: string; duration?: string } | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return "Tipo inválido. Use MP4, WebM, MOV ou AVI.";
    return null;
  };

  const handleFile = useCallback((file: File) => {
    setError("");
    setState("validating");
    const err = validate(file);
    if (err) { setError(err); setState("error"); return; }
    const preview = URL.createObjectURL(file);
    setVideoFile({ file, preview, size: formatBytes(file.size) });
    setState("idle");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const requestPassword = () => {
    setState("confirm");
    setPassword("");
    setAuthError("");
  };

  const submitUpload = async () => {
    setAuthError("");

    // Valida senha
    try {
      const res = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setAuthError("Senha incorreta.");
        return;
      }
    } catch {
      console.warn("API /api/verify-password não disponível — modo desenvolvimento");
    }

    if (!videoFile) return;

    setState("uploading");
    setProgress(0);

    try {
      // 1. Obtém presigned URL do MinIO
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao obter URL de upload.");
      }

      const { url: presignedUrl } = await urlRes.json();

      // 2. Faz upload direto para o MinIO via XHR (para acompanhar progresso)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload falhou com status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Erro de rede durante o upload.")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelado.")));

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", "video/mp4");
        xhr.send(videoFile.file);
      });

      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido durante o upload.");
      setState("error");
    }
  };

  const cancelUpload = () => {
    xhrRef.current?.abort();
    setState("idle");
    setProgress(0);
  };

  const reset = () => {
    setVideoFile(null);
    setState("idle");
    setProgress(0);
    setError("");
    setPassword("");
    setAuthError("");
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(STREAM_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="pt-14 min-h-screen">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="w-4 h-4 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Upload de Stream</h1>
            <p className="text-sm text-muted-foreground">
              Envie um vídeo que será publicado como <span className="font-mono text-primary">stream.mp4</span>
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-8 space-y-5">

          {/* Drop Zone */}
          {!videoFile && state !== "success" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300 p-14 flex flex-col items-center gap-5 ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-card"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${dragOver ? "bg-primary/20" : "bg-secondary"}`}>
                <Film className={`w-8 h-8 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground mb-1">
                  {dragOver ? "Solte o vídeo aqui" : "Arraste e solte o vídeo"}
                </p>
                <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {["MP4", "WebM", "MOV", "AVI"].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground font-mono">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
              <button onClick={() => { setError(""); setState("idle"); }} className="ml-auto">
                <X className="w-4 h-4 text-destructive/60 hover:text-destructive" />
              </button>
            </div>
          )}

          {/* File Preview + Actions */}
          {videoFile && state !== "success" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <video
                src={videoFile.preview}
                className="w-full max-h-56 object-contain bg-black"
                controls
                onLoadedMetadata={(e) => {
                  const v = e.target as HTMLVideoElement;
                  const m = Math.floor(v.duration / 60);
                  const s = Math.floor(v.duration % 60);
                  setVideoFile(prev => prev ? { ...prev, duration: `${m}:${s.toString().padStart(2, "0")}` } : prev);
                }}
              />
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Film className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {videoFile.file.name}
                      <span className="ml-2 text-xs font-mono text-primary">→ stream.mp4</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {videoFile.size}{videoFile.duration && ` · ${videoFile.duration}`}
                    </p>
                  </div>
                </div>
                {state === "idle" && (
                  <button onClick={reset} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="px-4 pb-4">
                {/* Step 1: Click to publish */}
                {state === "idle" && (
                  <button
                    onClick={requestPassword}
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Publicar como stream.mp4
                  </button>
                )}

                {/* Step 2: Password confirmation */}
                {state === "confirm" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="w-4 h-4 text-primary" />
                      <span>Confirme a senha para enviar</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Senha de upload"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setAuthError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && password && submitUpload()}
                        className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        autoFocus
                      />
                      <button
                        onClick={submitUpload}
                        disabled={!password}
                        className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Enviar
                      </button>
                    </div>
                    {authError && (
                      <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                        {authError}
                      </p>
                    )}
                    <button
                      onClick={() => setState("idle")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Step 3: Uploading */}
                {state === "uploading" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        Enviando para o servidor...
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary">{progress}%</span>
                        <button
                          onClick={cancelUpload}
                          className="text-destructive/60 hover:text-destructive transition-colors"
                          title="Cancelar upload"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-100"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success */}
          {state === "success" && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Publicado com sucesso!</p>
                  <p className="text-xs text-muted-foreground">
                    O vídeo está disponível como <span className="font-mono text-primary">stream.mp4</span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-secondary border border-border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">URL de exibição</p>
                  <p className="text-sm font-mono text-primary">{STREAM_URL}</p>
                </div>
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-background"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
                >
                  Novo Upload
                </button>
                <Link
                  to="/tv"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold text-center transition-all hover:brightness-110"
                >
                  <Tv className="w-4 h-4" />
                  Ver no Player
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UploadPage;
