import json
import yt_dlp


QUALITY_FORMAT_MAP = {
    'MP4': {
        '4K':   'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160][ext=mp4]/best',
        '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
        '720p':  'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
        '360p':  'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best',
    },
    'WEBM': {
        '4K':   'bestvideo[height<=2160][ext=webm]+bestaudio[ext=webm]/best[height<=2160]',
        '1080p': 'bestvideo[height<=1080][ext=webm]+bestaudio[ext=webm]/best[height<=1080]',
        '720p':  'bestvideo[height<=720][ext=webm]+bestaudio[ext=webm]/best[height<=720]',
        '360p':  'bestvideo[height<=360][ext=webm]+bestaudio[ext=webm]/best[height<=360]',
    },
    'MP3': {
        'any': 'bestaudio/best',
    },
}


def handler(event: dict, context) -> dict:
    """Возвращает прямую ссылку для скачивания видео/аудио в нужном формате и качестве."""

    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': ''
        }

    body = json.loads(event.get('body') or '{}')
    url = body.get('url', '').strip()
    fmt = body.get('format', 'MP4').upper()
    quality = body.get('quality', '720p')

    if not url:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'URL обязателен'})
        }

    if fmt not in QUALITY_FORMAT_MAP:
        fmt = 'MP4'

    if fmt == 'MP3':
        format_str = QUALITY_FORMAT_MAP['MP3']['any']
    else:
        format_str = QUALITY_FORMAT_MAP[fmt].get(quality, QUALITY_FORMAT_MAP[fmt]['720p'])

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'format': format_str,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    # Для MP3 — берём лучший аудио-формат
    if fmt == 'MP3':
        audio_formats = [
            f for f in info.get('formats', [])
            if f.get('acodec') != 'none' and f.get('vcodec') == 'none'
        ]
        if audio_formats:
            best_audio = sorted(audio_formats, key=lambda f: f.get('abr', 0) or 0, reverse=True)[0]
            direct_url = best_audio.get('url', '')
            ext = best_audio.get('ext', 'm4a')
        else:
            direct_url = info.get('url', '')
            ext = 'm4a'
    else:
        # Для видео — берём запрошенный формат
        requested = info.get('requested_formats') or []
        if requested:
            # Есть отдельные видео+аудио треки — отдаём видео-трек (браузер не может merge)
            # Поэтому ищем единый формат с обоими треками
            merged = [
                f for f in info.get('formats', [])
                if f.get('acodec') != 'none'
                and f.get('vcodec') != 'none'
                and (fmt == 'WEBM' or f.get('ext') == 'mp4')
            ]
            if merged:
                # Выбираем по высоте
                target_h = int(quality.replace('p', '').replace('K', '000').replace('4000', '2160'))
                merged_sorted = sorted(
                    merged,
                    key=lambda f: abs((f.get('height') or 0) - target_h)
                )
                direct_url = merged_sorted[0].get('url', '')
                ext = merged_sorted[0].get('ext', 'mp4')
            else:
                direct_url = info.get('url', '')
                ext = 'mp4'
        else:
            direct_url = info.get('url', '')
            ext = info.get('ext', 'mp4')

    title = info.get('title', 'video')

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps({
            'download_url': direct_url,
            'filename': f"{title[:60]}.{ext}",
            'ext': ext,
            'title': title,
        }, ensure_ascii=False)
    }
