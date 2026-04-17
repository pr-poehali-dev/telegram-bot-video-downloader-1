import json
import yt_dlp


def handler(event: dict, context) -> dict:
    """Получает информацию о видео по URL: название, превью, доступные форматы и качество."""

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

    if not url:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'URL обязателен'})
        }

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    # Определяем доступные качества
    formats = info.get('formats', [])
    available_qualities = set()
    for f in formats:
        h = f.get('height')
        if h:
            if h >= 2160:
                available_qualities.add('4K')
            elif h >= 1080:
                available_qualities.add('1080p')
            elif h >= 720:
                available_qualities.add('720p')
            elif h >= 360:
                available_qualities.add('360p')

    quality_order = ['4K', '1080p', '720p', '360p']
    sorted_qualities = [q for q in quality_order if q in available_qualities]

    # Fallback если нет явных качеств
    if not sorted_qualities:
        sorted_qualities = ['720p', '360p']

    duration_sec = info.get('duration', 0)
    hours = duration_sec // 3600
    minutes = (duration_sec % 3600) // 60
    seconds = duration_sec % 60
    if hours:
        duration_str = f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        duration_str = f"{minutes}:{seconds:02d}"

    result = {
        'title': info.get('title', 'Без названия'),
        'channel': info.get('uploader', info.get('channel', '')),
        'duration': duration_str,
        'thumbnail': info.get('thumbnail', ''),
        'qualities': sorted_qualities,
        'platform': info.get('extractor_key', 'unknown'),
    }

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False)
    }
