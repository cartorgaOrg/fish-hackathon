"""
Step 1: Generate voice candidates from a character description.
Usage: uv run design_voices.py "Brom the Guard"
https://docs.fish.audio/features/voice-design.md
"""

import base64
import os
import sys
from pathlib import Path

import httpx
from dotenv import find_dotenv, load_dotenv

from game import CHARACTERS, get_character_by_name

load_dotenv(find_dotenv())

if not os.getenv("FISH_API_KEY"):
    print("[ERROR] FISH_API_KEY not set. Please add it to .env or export it.")
    exit(1)

# Get NPC name from command line, or use first character
npc_name = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else CHARACTERS[0].name
character = get_character_by_name(npc_name)

if not character:
    print(f"[ERROR] Character '{npc_name}' not found.")
    print(f"Available: {', '.join(c.name for c in CHARACTERS)}")
    exit(1)

out_dir = Path("out")
out_dir.mkdir(exist_ok=True)

print(f"[voice-design] Generating voices for: {character.name}")
print(f"  Description: {character.description}\n")

# Call Voice Design API
url = "https://api.fish.audio/v1/voice-design"
headers = {
    "Authorization": f"Bearer {os.getenv('FISH_API_KEY')}",
    "Content-Type": "application/json",
    "model": "voice-design-1",
}
payload = {
    "instruction": character.description,
    "reference_text": character.sample_line,
    "language": "en",
    "n": 2,
}

response = httpx.post(url, headers=headers, json=payload, timeout=120)
response.raise_for_status()
result = response.json()

candidates = result.get("candidates", [])
if not candidates:
    print("[ERROR] No candidates returned.")
    exit(1)

print(f"[voice-design] Received {len(candidates)} candidates\n")

# Save WAV files
for i, candidate in enumerate(candidates, 1):
    audio_bytes = base64.b64decode(candidate["audio_base64"])
    filename = f"{character.name.replace(' ', '_')}_candidate_{i}.wav"
    filepath = out_dir / filename

    with open(filepath, "wb") as f:
        f.write(audio_bytes)

    sample_rate = candidate.get("sample_rate", "?")
    duration_ms = candidate.get("duration_ms", "?")
    duration_s = f"{duration_ms / 1000:.1f}" if isinstance(duration_ms, (int, float)) else "?"
    print(f"[voice-design] {filename}")
    print(f"  Sample rate: {sample_rate} Hz, Duration: {duration_s}s")
    print(f"  ID: {candidate.get('id', 'unknown')}\n")

print(f"[voice-design] Next: uv run save_voice.py \"{character.name}\" 1")
