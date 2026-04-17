import json
import os
import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
API = f"https://api.telegram.org/bot{TOKEN}"
BOT_URL = "https://functions.poehali.dev/febe1342-229a-4db4-9ab5-5ca50d70749b"


def handler(event: dict, context) -> dict:
    """Регистрирует webhook Telegram-бота. Вызвать один раз через браузер."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*"}, "body": ""}

    r = requests.post(f"{API}/setWebhook", json={"url": BOT_URL}, timeout=10)
    result = r.json()

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
        "body": json.dumps(result),
    }
