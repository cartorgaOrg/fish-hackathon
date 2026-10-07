"""
MOCKUP GAME: a stand-in so this example runs end to end. It is NOT where your real game has to live.
Keep the audio code, connect your real game (engine, frontend, backend, ...) to the GAME HOOK touch
points below, then delete the mock content.

Mock game content: dialogue lines and narrator beats.
GAME HOOK: Replace LINES with your game's actual dialogue tree.
"""

from dataclasses import dataclass


@dataclass
class DialogueLine:
    """A line to synthesize to audio."""

    text: str  # The words to speak
    speaker: str  # Speaker name or "Narrator"
    voice_id: str | None = None  # Optional custom voice model ID
    emotions: list[str] | None = None  # S2.1-Pro emotion tags: [angry], [happy], [whispered], etc.

    def emotion_text(self) -> str:
        """Wrap text with emotion tags.
        https://docs.fish.audio/developer-guide/core-features/emotions.md
        """
        if not self.emotions:
            return self.text
        tags = " ".join(f"[{e}]" for e in self.emotions)
        return f"{tags} {self.text}"


# MOCKUP: Replace with actual dialogue from your game tree or narrative.
LINES = [
    DialogueLine(
        "You awaken in the village square. The air is cold and morning mist clings to the ground.",
        "Narrator",
        emotions=["calm"],
    ),
    DialogueLine(
        "Halt, traveller! The bridge to the north is closed tonight. Bandits, you see.",
        "Brom the Guard",
        emotions=["stern"],
    ),
    DialogueLine(
        "But I must reach the inn before nightfall!",
        "Narrator",
        emotions=["urgent"],
    ),
    DialogueLine(
        "Then I suggest you try the eastern path. Longer, but safer.",
        "Brom the Guard",
        emotions=["gruff"],
    ),
]
