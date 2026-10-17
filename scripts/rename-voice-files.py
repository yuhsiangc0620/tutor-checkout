"""Rename VoAI exports to the IDs used by voice/lines.json.

Run once after copying the exported MP3s into public/voice-lines/.
Unknown or duplicate takes are kept in public/voice-lines/unmatched/.
"""

import json
from pathlib import Path


root = Path(__file__).resolve().parent.parent
audio_dir = root / "public" / "voice-lines"
lines = json.loads((root / "voice" / "lines.json").read_text())
ids = {line["id"] for line in lines}

mapping = {
    "idle_start": "請點螢幕中間",
    "welcome": "您好！我是您",
    "tutorial_choice": "請問您需不需",
    "scan_intro": "太好了！我們",
    "review": "請您確認螢幕",
    "payment_choice": "您今天想用什",
    "payment_sensing": "感應中，請把",
    "complete": "太棒了！結帳",
    "farewell": "好的！謝謝您",
    "scan_success": "掃描成功！請",
    "rescue_scan": "需要我示範怎",
    "rescue_payment": "需要我示範怎 (1)",
    "rescue_scan_gentle": "慢慢來，不急",
    "rescue_payment_gentle": "慢慢拿卡片，",
    "help_remove_scan": "請找到想移除",
    "help_remove_other": "請先回到商品",
    "help_remove_empty": "清單裡還沒有",
    "help_scan": "把商品卡平放",
    "help_pay_empty": "請先點開始結",
    "help_pay_sensing": "請把專用展示",
    "help_pay_method": "請先選擇行動",
    "help_pay_done": "這一筆已經完",
    "help_pay_review": "請確認商品與",
    "help_pay_scan": "商品都齊了，",
    "help_next_scan": "商品都齊了， (1)",
    "help_unknown": "我還不太明白",
    "notice_unknown_card": "這張卡還沒有",
    "notice_select_payment": "請先選擇付款",
    "notice_product_in_payment": "這是商品卡。",
    "notice_payment_too_early": "請先確認商品",
    "notice_review_card": "請先確認金額",
    "notice_missing_product": "商品資料不存",
    "notice_max_quantity": "這項商品已達",
    "tutorial_scan": "請看慢動作示",
    "tutorial_review": "檢查商品、數",
    "tutorial_payment": "先選擇付款方",
    "total_prefix": "目前共有",
    "total_middle": "件商品，合計",
    "total_suffix": "元。",
    "number_0": "零",
    "number_1": "一",
    "number_2": "二",
    "number_3": "三",
    "number_4": "四",
    "number_5": "五",
    "number_6": "六",
    "number_7": "七",
    "number_8": "八",
    "number_9": "九",
    "number_10": "十",
    "number_100": "百",
    "number_1000": "千",
    "number_10000": "萬",
    "number_100000000": "億",
}

assert set(mapping) == ids - {"print_receipt"}
assert len(set(mapping.values())) == len(mapping)
prefix = "Neo_國賢_預設-"
for voice_id, stem in mapping.items():
    source = audio_dir / f"{prefix}{stem}.mp3"
    target = audio_dir / f"{voice_id}.mp3"
    if target.exists():
        raise SystemExit(f"Target already exists: {target}")
    if not source.is_file():
        raise SystemExit(f"Source missing: {source}")

for voice_id, stem in mapping.items():
    (audio_dir / f"{prefix}{stem}.mp3").rename(audio_dir / f"{voice_id}.mp3")

unmatched = audio_dir / "unmatched"
unmatched.mkdir(exist_ok=True)
for source in audio_dir.glob(f"{prefix}*.mp3"):
    source.rename(unmatched / source.name)

print(f"Renamed {len(mapping)} clips; {len(list(unmatched.glob('*.mp3')))} unmatched clips preserved.")
