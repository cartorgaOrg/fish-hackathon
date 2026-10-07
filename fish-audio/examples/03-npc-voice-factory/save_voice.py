"""
Step 2: Save a voice candidate as a persistent voice model, then speak with it.
Usage: uv run save_voice.py "Brom the Guard" 1
https://docs.fish.audio/developer-guide/best-practices/voice-cloning.md
"""

import os
import sys
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from fishaudio import FishAudio
from fishaudio.utils import save

from game import get_character_by_name

load_dotenv(find_dotenv())

if not os.getenv("FISH_API_KEY"):
    print("[ERROR] FISH_API_KEY not set. Please add it to .env or export it.")
    exit(1)

if len(sys.argv) < 2:
    print("Usage: uv run save_voice.py <character_name> [candidate_number]")
    print("Example: uv run save_voice.py \"Brom the Guard\" 1")
    exit(1)

# Parse args: last arg is candidate number if it's a digit, rest is character name
if sys.argv[-1].isdigit():
    candidate_num = int(sys.argv[-1])
    npc_name = " ".join(sys.argv[1:-1])
else:
    candidate_num = 1
    npc_name = " ".join(sys.argv[1:])

character = get_character_by_name(npc_name)
if not character:
    print(f"[ERROR] Character '{npc_name}' not found.")
    exit(1)

out_dir = Path("out")
candidate_file = out_dir / f"{character.name.replace(' ', '_')}_candidate_{candidate_num}.wav"

if not candidate_file.exists():
    print(f"[ERROR] Candidate file not found: {candidate_file}")
    print("Run design_voices.py first to generate candidates.")
    exit(1)

with open(candidate_file, "rb") as f:
    audio_bytes = f.read()

client = FishAudio()

# Create persistent voice model
print(f"[voice-clone] Creating voice model from: {candidate_file.name}")
voice = client.voices.create(
    title=f"{character.name} (Generated)",
    voices=[audio_bytes],
)
voice_id = voice.id

print(f"[voice-clone] Voice created!")
print(f"  ID: {voice_id}")
print(f"  Use in game: FISH_VOICE_ID={voice_id}")
print()

# Demo: Speak with the saved voice
print("[voice-clone] Demo: Speaking with saved voice")
text = character.sample_line
print(f"  Text: {text}")

tts_model = os.getenv("FISH_TTS_MODEL", "s2.1-pro")
audio = client.tts.convert(
    text=text,
    model=tts_model,  # type: ignore
    reference_id=voice_id,
    format="mp3",
)

output_file = out_dir / f"{character.name.replace(' ', '_')}_demo.mp3"
save(audio, str(output_file))
print(f"  Saved to: {output_file.name}")
