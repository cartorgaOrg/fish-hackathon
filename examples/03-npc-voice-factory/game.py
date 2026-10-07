"""
MOCKUP GAME: a stand-in so this example runs end to end. It is NOT where your real game has to live.
Keep the audio code, connect your real game (engine, frontend, backend, ...) to the GAME HOOK touch
points below, then delete the mock content.

Mock NPC character definitions for voice design.
GAME HOOK: Replace CHARACTERS with your game's NPCs, derived from your character sheet.
"""

from dataclasses import dataclass


@dataclass
class NPCCharacter:
    """An NPC character with voice description and sample line."""

    name: str
    description: str  # 1-2 sentences describing the voice
    sample_line: str  # A short line to speak in this voice


# MOCKUP: Replace with your actual game NPCs.
CHARACTERS = [
    NPCCharacter(
        name="Brom the Guard",
        description="Grumpy, gravelly voice. Slow, measured speech with authority. Seasoned soldier, tired but watchful.",
        sample_line="The bridge is closed tonight. Bandits, you see.",
    ),
    NPCCharacter(
        name="Elara the Innkeeper",
        description="Warm, welcoming tone with a slight laugh. Quick energetic speech. Friendly older woman.",
        sample_line="Welcome, traveller! You look like you need a hot meal.",
    ),
    NPCCharacter(
        name="Whisper the Rogue",
        description="Soft-spoken, mysterious whisper. Fast, clipped speech. A thief with secrets.",
        sample_line="Psst! Looking to make a quick coin?",
    ),
]


def get_character_by_name(name: str) -> NPCCharacter | None:
    """Lookup a character by name (case-insensitive)."""
    for char in CHARACTERS:
        if char.name.lower() == name.lower():
            return char
    return None
