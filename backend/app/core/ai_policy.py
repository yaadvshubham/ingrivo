"""Safety policy for AI health verdicts, overclaims, and prohibited language.

Stored as clear structured data with rationale per entry.
Used by ai_validator.py to reject any response containing non-educational,
alarmist, or speculative claims.
"""

from typing import NamedTuple


class ProhibitedPhrase(NamedTuple):
    phrase: str
    rationale: str


PROHIBITED_PHRASES: list[ProhibitedPhrase] = [
    # Health verdicts
    ProhibitedPhrase("healthy choice", "Health verdicts are forbidden; educational description only."),
    ProhibitedPhrase("unhealthy choice", "Health verdicts are forbidden; educational description only."),
    ProhibitedPhrase("very healthy", "Subjective health score without clinical context."),
    ProhibitedPhrase("very unhealthy", "Subjective health score without clinical context."),
    ProhibitedPhrase("good for you", "Subjective moral framing of food."),
    ProhibitedPhrase("bad for you", "Subjective moral framing of food."),
    ProhibitedPhrase("superfood", "Marketing buzzword with no regulatory definition."),
    ProhibitedPhrase("junk food", "Subjective derogatory categorization."),

    # Medical & Disease claims
    ProhibitedPhrase("cures", "Medical/therapeutic treatment claim."),
    ProhibitedPhrase("prevents cancer", "Disease prevention claim."),
    ProhibitedPhrase("treats disease", "Medical intervention claim."),
    ProhibitedPhrase("boosts immunity", "Unsubstantiated physiological claim."),
    ProhibitedPhrase("detoxifies", "Pseudoscience physiological claim."),
    ProhibitedPhrase("cleanses your body", "Pseudoscience claim."),
    ProhibitedPhrase("weight loss miracle", "Misleading dietetic claim."),
    ProhibitedPhrase("burns fat", "Unsubstantiated metabolic claim."),

    # Absolute safety / Alarmist fear language
    ProhibitedPhrase("100% safe", "Absolute safety claim; cannot be verified."),
    ProhibitedPhrase("completely safe", "Absolute safety claim."),
    ProhibitedPhrase("totally safe", "Absolute safety claim."),
    ProhibitedPhrase("toxic", "Alarmist fear language; dose makes the poison."),
    ProhibitedPhrase("poisonous", "Alarmist fear language."),
    ProhibitedPhrase("deadly", "Alarmist fear language."),
    ProhibitedPhrase("chemical poison", "Chemophobic demonization of additives."),
    ProhibitedPhrase("carcinogenic poison", "Alarmist health claim."),
    ProhibitedPhrase("harmful chemical", "Chemophobic blanket statement."),
    ProhibitedPhrase("dangerous additive", "Unregulated additive fearmongering."),
    # Comparison ranking & verdict language (Phase 8)
    ProhibitedPhrase("better", "Ranking comparison verdict; must use neutral higher/lower."),
    ProhibitedPhrase("worse", "Ranking comparison verdict; must use neutral higher/lower."),
    ProhibitedPhrase("healthier", "Subjective health ranking without clinical context."),
    ProhibitedPhrase("unhealthy", "Moral/judgmental labeling of food items."),
    ProhibitedPhrase("winner", "Gamification or competitive ranking of food products."),
    ProhibitedPhrase("should choose", "Directive purchasing advice; non-prescriptive only."),
    ProhibitedPhrase("prefer", "Prescriptive dietary preference advice."),
    ProhibitedPhrase("superior", "Subjective product ranking."),
    ProhibitedPhrase("inferior", "Subjective product ranking."),
    ProhibitedPhrase("best choice", "Prescriptive purchasing advice."),
    ProhibitedPhrase("worst choice", "Prescriptive purchasing advice."),
    ProhibitedPhrase("healthiest", "Superlative health ranking."),
    ProhibitedPhrase("least healthy", "Superlative health ranking."),
    ProhibitedPhrase("more nutritious", "Subjective aggregate nutritional judgment."),
    ProhibitedPhrase("less nutritious", "Subjective aggregate nutritional judgment."),
]

PROHIBITED_PHRASE_STRINGS: set[str] = {p.phrase.lower() for p in PROHIBITED_PHRASES}

COMPARE_PROHIBITED_PHRASES: list[ProhibitedPhrase] = [
    ProhibitedPhrase("better", "Ranking comparison verdict."),
    ProhibitedPhrase("worse", "Ranking comparison verdict."),
    ProhibitedPhrase("healthier", "Subjective health ranking."),
    ProhibitedPhrase("unhealthy", "Moral/judgmental labeling."),
    ProhibitedPhrase("winner", "Competitive ranking."),
    ProhibitedPhrase("should choose", "Directive advice."),
    ProhibitedPhrase("prefer", "Prescriptive advice."),
    ProhibitedPhrase("superior", "Subjective ranking."),
    ProhibitedPhrase("inferior", "Subjective ranking."),
    ProhibitedPhrase("best choice", "Prescriptive advice."),
    ProhibitedPhrase("worst choice", "Prescriptive advice."),
    ProhibitedPhrase("healthiest", "Superlative ranking."),
    ProhibitedPhrase("least healthy", "Superlative ranking."),
    ProhibitedPhrase("more nutritious", "Subjective judgment."),
    ProhibitedPhrase("less nutritious", "Subjective judgment."),
]

COMPARE_PROHIBITED_STRINGS: set[str] = PROHIBITED_PHRASE_STRINGS.union(
    {p.phrase.lower() for p in COMPARE_PROHIBITED_PHRASES}
)
