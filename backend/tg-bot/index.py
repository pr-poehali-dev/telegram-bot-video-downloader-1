import json
import os
import tempfile
import yt_dlp
import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
API = f"https://api.telegram.org/bot{TOKEN}"

QUALITY_LABELS = {
    "best": "🏆 Лучшее качество",
    "1080p": "📺 1080p Full HD",
    "720p": "📺 720p HD",
    "360p": "📱 360p (лёгкое)",
    "mp3": "🎵 Только аудио MP3",
}

FORMAT_MAP = {
    "best":  "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
    "720p":  "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
    "360p":  "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best",
    "mp3":   "bestaudio/best",
}


def tg(method: str, **kwargs) -> dict:
    r = requests.post(f"{API}/{method}", json=kwargs, timeout=30)
    return r.json()


def send_message(chat_id: int, text: str, **kwargs):
    return tg("sendMessage", chat_id=chat_id, text=text, **kwargs)


def send_quality_keyboard(chat_id: int, url: str):
    buttons = [
        [{"text": QUALITY_LABELS["best"],  "callback_data": f"dl|best|{url}"}],
        [{"text": QUALITY_LABELS["1080p"], "callback_data": f"dl|1080p|{url}"}],
        [{"text": QUALITY_LABELS["720p"],  "callback_data": f"dl|720p|{url}"}],
        [{"text": QUALITY_LABELS["360p"],  "callback_data": f"dl|360p|{url}"}],
        [{"text": QUALITY_LABELS["mp3"],   "callback_data": f"dl|mp3|{url}"}],
    ]
    send_message(
        chat_id,
        "🎬 Выбери формат и качество:",
        reply_markup={"inline_keyboard": buttons},
    )


def get_video_info(url: str) -> dict:
    opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def download_and_send(chat_id: int, url: str, quality: str, message_id: int):
    """Скачивает видео/аудио и отправляет файл в чат."""
    is_audio = quality == "mp3"
    fmt = FORMAT_MAP.get(quality, FORMAT_MAP["720p"])

    status_msg = tg(
        "sendMessage",
        chat_id=chat_id,
        text="⏳ Скачиваю, подожди немного...",
    )
    status_id = status_msg.get("result", {}).get("message_id")

    with tempfile.TemporaryDirectory() as tmpdir:
        out_template = os.path.join(tmpdir, "%(title)s.%(ext)s")

        ydl_opts = {
            "format": fmt,
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
            "merge_output_format": "mp4" if not is_audio else None,
        }

        if is_audio:
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "video")[:60]

        # Находим скачанный файл
        files = os.listdir(tmpdir)
        if not files:
            raise RuntimeError("Файл не скачан")
        filepath = os.path.join(tmpdir, files[0])
        filesize = os.path.getsize(filepath)

        # Telegram лимит — 50 MB для ботов
        if filesize > 50 * 1024 * 1024:
            tg("editMessageText", chat_id=chat_id, message_id=status_id,
               text="❌ Файл больше 50 МБ — Telegram не принимает такие файлы.\nПопробуй выбрать качество 720p или 360p.")
            return

        # Обновляем статус
        tg("editMessageText", chat_id=chat_id, message_id=status_id,
           text="📤 Отправляю файл...")

        with open(filepath, "rb") as f:
            if is_audio:
                requests.post(
                    f"{API}/sendAudio",
                    data={"chat_id": chat_id, "title": title, "performer": "SaveFlow"},
                    files={"audio": (f"{title}.mp3", f, "audio/mpeg")},
                    timeout=120,
                )
            else:
                requests.post(
                    f"{API}/sendVideo",
                    data={"chat_id": chat_id, "caption": f"🎬 {title}"},
                    files={"video": (f"{title}.mp4", f, "video/mp4")},
                    timeout=120,
                )

        # Удаляем статусное сообщение
        tg("deleteMessage", chat_id=chat_id, message_id=status_id)


def handler(event: dict, context) -> dict:
    """Webhook-обработчик Telegram-бота для скачивания видео через yt-dlp."""

    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": "",
        }

    body = json.loads(event.get("body") or "{}")

    # Входящее сообщение
    if "message" in body:
        msg = body["message"]
        chat_id = msg["chat"]["id"]
        text = msg.get("text", "").strip()

        if text in ("/start", "/help"):
            send_message(
                chat_id,
                "👋 Привет! Я SaveFlow — бот для скачивания видео.\n\n"
                "Просто отправь мне ссылку на видео с YouTube, VK, Rutube, TikTok и других платформ — "
                "и я скачаю его прямо в этот чат.\n\n"
                "🎬 Поддерживаю видео (MP4) и аудио (MP3).",
            )
            return {"statusCode": 200, "body": "ok"}

        # Проверяем, похоже ли на URL
        if text.startswith("http://") or text.startswith("https://"):
            try:
                # Получаем инфо о видео для валидации
                info = get_video_info(text)
                title = info.get("title", "Видео")[:50]
                duration = info.get("duration", 0)
                mins = duration // 60
                secs = duration % 60

                send_message(
                    chat_id,
                    f"✅ Нашёл: *{title}*\n⏱ {mins}:{secs:02d}",
                    parse_mode="Markdown",
                )
                send_quality_keyboard(chat_id, text)
            except Exception as e:
                send_message(
                    chat_id,
                    f"❌ Не удалось получить видео.\nПроверь ссылку и попробуй снова.\n\n`{str(e)[:100]}`",
                    parse_mode="Markdown",
                )
        else:
            send_message(
                chat_id,
                "🔗 Отправь мне ссылку на видео, например:\nhttps://youtube.com/watch?v=...",
            )

    # Нажатие кнопки
    elif "callback_query" in body:
        cb = body["callback_query"]
        chat_id = cb["message"]["chat"]["id"]
        message_id = cb["message"]["message_id"]
        data = cb.get("data", "")

        # Подтверждаем нажатие
        tg("answerCallbackQuery", callback_query_id=cb["id"])

        if data.startswith("dl|"):
            parts = data.split("|", 2)
            if len(parts) == 3:
                _, quality, url = parts
                try:
                    # Удаляем сообщение с кнопками
                    tg("deleteMessage", chat_id=chat_id, message_id=message_id)
                    download_and_send(chat_id, url, quality, message_id)
                except Exception as e:
                    send_message(
                        chat_id,
                        f"❌ Ошибка при скачивании:\n`{str(e)[:200]}`",
                        parse_mode="Markdown",
                    )

    return {"statusCode": 200, "body": "ok"}
