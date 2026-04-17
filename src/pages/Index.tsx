import { useState } from "react";
import Icon from "@/components/ui/icon";

const VIDEO_INFO_URL = "https://functions.poehali.dev/57f63a66-0a81-41ea-af47-6aea9e4b8989";
const VIDEO_DOWNLOAD_URL = "https://functions.poehali.dev/e33ce016-3975-477e-a571-ec38a69e4139";

type Quality = "360p" | "720p" | "1080p" | "4K";
type Format = "MP4" | "WEBM" | "MP3";
type Stage = "idle" | "loading" | "ready" | "downloading";

interface VideoInfo {
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  qualities: Quality[];
  platform: string;
}

const ALL_QUALITIES: { label: Quality; note?: string }[] = [
  { label: "360p", note: "лёгкое" },
  { label: "720p", note: "HD" },
  { label: "1080p", note: "Full HD" },
  { label: "4K", note: "Ultra" },
];

const FORMATS: { label: Format; icon: string; desc: string }[] = [
  { label: "MP4", icon: "Video", desc: "видео" },
  { label: "WEBM", icon: "Film", desc: "видео" },
  { label: "MP3", icon: "Music", desc: "только аудио" },
];

const SIZE_ESTIMATES: Record<Quality, string> = {
  "360p": "~35 MB",
  "720p": "~90 MB",
  "1080p": "~180 MB",
  "4K": "~600 MB",
};

export default function Index() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [format, setFormat] = useState<Format>("MP4");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const isMP3 = format === "MP3";

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setStage("loading");
    setProgress(0);
    setError(null);

    // Плавный прогресс-бар пока идёт запрос
    let fakeProgress = 0;
    const interval = setInterval(() => {
      fakeProgress += Math.random() * 12;
      if (fakeProgress >= 85) {
        clearInterval(interval);
        fakeProgress = 85;
      }
      setProgress(fakeProgress);
    }, 150);

    try {
      const res = await fetch(VIDEO_INFO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      clearInterval(interval);
      setProgress(100);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Не удалось получить информацию о видео");
      }

      const data: VideoInfo = await res.json();
      setVideoInfo(data);

      // Устанавливаем лучшее доступное качество
      if (data.qualities.length > 0 && !isMP3) {
        const best = data.qualities[0];
        setQuality(best);
      }

      setTimeout(() => setStage("ready"), 200);
    } catch (e: unknown) {
      clearInterval(interval);
      setError(e instanceof Error ? e.message : "Произошла ошибка. Проверьте ссылку и попробуйте снова.");
      setStage("idle");
      setProgress(0);
    }
  };

  const handleDownload = async (dlFormat: Format, dlQuality?: Quality) => {
    if (!videoInfo) return;
    const key = `${dlFormat}-${dlQuality ?? "mp3"}`;
    setDownloadingKey(key);

    try {
      const res = await fetch(VIDEO_DOWNLOAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          format: dlFormat,
          quality: dlQuality ?? "720p",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка при получении ссылки для скачивания");
      }

      const data = await res.json();
      const downloadUrl: string = data.download_url;
      const filename: string = data.filename;

      // Открываем ссылку в новой вкладке
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Ошибка скачивания");
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleReset = () => {
    setUrl("");
    setStage("idle");
    setProgress(0);
    setVideoInfo(null);
    setError(null);
  };

  const availableQualities = videoInfo?.qualities ?? ALL_QUALITIES.map((q) => q.label);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-5 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
            <Icon name="ArrowDown" size={14} className="text-background" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">SaveFlow</span>
        </div>
        <span className="font-mono-dm text-xs text-muted-foreground">v1.0</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* ── IDLE ── */}
        {stage === "idle" && (
          <div className="w-full max-w-xl animate-slide-up">
            {/* Hero */}
            <div className="mb-12 text-center">
              <p className="text-xs font-mono-dm text-muted-foreground mb-4 tracking-widest uppercase">
                Загрузчик видео
              </p>
              <h1 className="text-[2.25rem] font-bold leading-tight tracking-tight text-foreground mb-3">
                Скачай любое видео
                <br />
                <span className="text-muted-foreground font-normal">в нужном формате</span>
              </h1>
              <p className="text-sm text-muted-foreground">YouTube, VK, Rutube и другие платформы</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-scale-in">
                <Icon name="AlertCircle" size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* URL Input */}
            <div className="relative mb-8">
              <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 focus-within:border-foreground transition-colors duration-200 shadow-sm">
                <Icon name="Link" size={16} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="Вставьте ссылку на видео..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                />
                {url && (
                  <button
                    onClick={() => setUrl("")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name="X" size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Format selector */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-3 font-mono-dm tracking-wider uppercase">Формат</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map(({ label, icon, desc }) => (
                  <button
                    key={label}
                    onClick={() => setFormat(label)}
                    className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border text-sm font-medium transition-all duration-200 ${
                      format === label
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    <Icon name={icon} size={18} />
                    <span>{label}</span>
                    <span className={`text-[10px] font-mono-dm ${format === label ? "text-background/60" : "text-muted-foreground"}`}>
                      {desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality selector */}
            {!isMP3 && (
              <div className="mb-8">
                <p className="text-xs text-muted-foreground mb-3 font-mono-dm tracking-wider uppercase">Качество</p>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_QUALITIES.map(({ label, note }) => (
                    <button
                      key={label}
                      onClick={() => setQuality(label)}
                      className={`flex flex-col items-center gap-0.5 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                        quality === label
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-foreground border-border hover:border-foreground/40"
                      }`}
                    >
                      <span>{label}</span>
                      {note && (
                        <span className={`text-[10px] font-mono-dm ${quality === label ? "text-background/60" : "text-muted-foreground"}`}>
                          {note}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isMP3 && <div className="mb-8" />}

            {/* CTA */}
            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className="w-full bg-foreground text-background py-4 rounded-2xl font-semibold text-sm tracking-wide hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Icon name="Search" size={16} />
              Анализировать ссылку
            </button>

            {/* Platforms */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Поддерживает:</span>
              {["YouTube", "VK", "Rutube", "TikTok"].map((p) => (
                <span key={p} className="text-xs font-mono-dm text-muted-foreground border border-border rounded-md px-2 py-0.5">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {stage === "loading" && (
          <div className="w-full max-w-xl animate-scale-in text-center">
            <div className="mb-8">
              <div className="w-14 h-14 rounded-2xl bg-foreground mx-auto mb-6 flex items-center justify-center">
                <Icon name="Loader" size={24} className="text-background animate-spin" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Анализирую ссылку</h2>
              <p className="text-sm text-muted-foreground font-mono-dm">
                {url.slice(0, 52)}{url.length > 52 ? "…" : ""}
              </p>
            </div>
            <div className="bg-secondary rounded-full h-1 overflow-hidden mb-3">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-xs font-mono-dm text-muted-foreground progress-pulse">
              {Math.min(Math.round(progress), 100)}%
            </p>
          </div>
        )}

        {/* ── READY ── */}
        {stage === "ready" && videoInfo && (
          <div className="w-full max-w-xl animate-scale-in">
            {/* Video card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6 shadow-sm">
              {videoInfo.thumbnail && (
                <div className="aspect-video bg-muted relative overflow-hidden">
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {videoInfo.duration && (
                    <div className="absolute bottom-3 right-3 bg-black/80 text-white font-mono-dm text-xs px-2 py-0.5 rounded-md">
                      {videoInfo.duration}
                    </div>
                  )}
                </div>
              )}
              <div className="p-4">
                <p className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{videoInfo.title}</p>
                <p className="text-xs text-muted-foreground font-mono-dm">{videoInfo.channel}</p>
              </div>
            </div>

            {/* Download options */}
            <div className="space-y-2.5 mb-6">
              <p className="text-xs font-mono-dm text-muted-foreground tracking-wider uppercase mb-3">
                Скачать видео
              </p>

              {availableQualities.map((q, i) => {
                const key = `MP4-${q}`;
                const isLoading = downloadingKey === key;
                return (
                  <button
                    key={q}
                    onClick={() => handleDownload("MP4", q)}
                    disabled={!!downloadingKey}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-card hover:border-foreground/40 hover:shadow-sm transition-all duration-200 animate-slide-up disabled:opacity-60"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                        <Icon name="Video" size={14} className="text-foreground" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">MP4 · {q}</p>
                        <p className="text-xs text-muted-foreground font-mono-dm">{SIZE_ESTIMATES[q]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {q === availableQualities[0] && (
                        <span className="text-[10px] font-mono-dm bg-foreground text-background px-1.5 py-0.5 rounded-md">
                          Лучшее
                        </span>
                      )}
                      {isLoading
                        ? <Icon name="Loader" size={16} className="text-muted-foreground animate-spin" />
                        : <Icon name="Download" size={16} className="text-muted-foreground" />
                      }
                    </div>
                  </button>
                );
              })}

              {/* MP3 */}
              <div className="pt-1">
                <p className="text-xs font-mono-dm text-muted-foreground tracking-wider uppercase mb-3">
                  Только аудио
                </p>
                <button
                  onClick={() => handleDownload("MP3")}
                  disabled={!!downloadingKey}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-card hover:border-foreground/40 hover:shadow-sm transition-all duration-200 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Icon name="Music" size={14} className="text-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">MP3 · Аудиодорожка</p>
                      <p className="text-xs text-muted-foreground font-mono-dm">~12 MB · наилучшее качество</p>
                    </div>
                  </div>
                  {downloadingKey === "MP3-mp3"
                    ? <Icon name="Loader" size={16} className="text-muted-foreground animate-spin" />
                    : <Icon name="Download" size={16} className="text-muted-foreground" />
                  }
                </button>
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="w-full py-3.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Icon name="RefreshCw" size={14} />
              Загрузить другое видео
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 flex items-center justify-between animate-fade-in">
        <p className="text-xs text-muted-foreground font-mono-dm">Только для личного использования</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon name="Shield" size={12} />
          <span>Безопасно</span>
        </div>
      </footer>
    </div>
  );
}
