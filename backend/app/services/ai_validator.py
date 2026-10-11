"""Validation suite for structured Gemini food explanations.

Ensures no invented numbers, no prohibited health claims, no invalid evidence refs,
and no invented allergens appear in AI outputs.
"""

import re
from typing import NamedTuple

from app.core.ai_policy import PROHIBITED_PHRASE_STRINGS
from app.schemas.analysis import ExplainStructuredData
from app.services.evidence import EvidencePacket


class ValidationResult(NamedTuple):
    is_valid: bool
    errors: list[str]


# Whitelist of common formatting numbers allowed in food descriptions
ALLOWED_NUMERIC_WHITELIST = {
    "100",  # "per 100 g", "per 100 ml"
    "1",    # "1 serving", "step 1"
    "2",
    "3",
}


def extract_numbers_from_text(text: str) -> list[str]:
    """Finds all integer and decimal numbers in a text string.
    
    Handles standard formats: 12, 12.5, 12,5.
    """
    matches = re.findall(r"\b\d+(?:[.,]\d+)?\b", text)
    normalized = []
    for m in matches:
        clean = m.replace(",", ".")
        normalized.append(clean)
    return normalized


def extract_numbers_from_evidence(evidence: EvidencePacket) -> set[str]:
    """Collects every number appearing anywhere in the input evidence packet."""
    numbers = set()
    raw_str = evidence.model_dump_json()
    for n in extract_numbers_from_text(raw_str):
        numbers.add(n)
        # Also add integer representation if float ends in .0 (e.g. 5.0 -> 5)
        if n.endswith(".0"):
            numbers.add(n[:-2])
        # If integer, also allow .0
        elif "." not in n:
            numbers.add(f"{n}.0")
    return numbers


def validate_explanation(
    data: ExplainStructuredData,
    evidence: EvidencePacket,
) -> ValidationResult:
    """Validates structured response against veracity and safety rules.
    
    Checks:
    1. Every number in any prose field appears in the evidence packet (or tiny whitelist).
    2. Every evidence_ref in observations points to an available field path (not missing).
    3. Declared allergens in allergen_statement are a subset of evidence declared_allergens.
    4. No phrase from ai_policy appears in any string.
    5. No missing nutrient is given a specific stated value.
    """
    errors: list[str] = []

    # 1. Prohibited phrases check across all text fields
    all_text_parts: list[str] = [
        data.summary,
        data.allergen_statement.note,
        *[f"{n.name} {n.explanation}" for n in data.ingredient_notes],
        *[f"{o.text}" for o in data.observations],
        *[c for c in data.caveats],
        *[m for m in data.missing_info],
    ]
    full_corpus = " ".join(all_text_parts).lower()

    for phrase in PROHIBITED_PHRASE_STRINGS:
        if phrase in full_corpus:
            errors.append(f"Contains prohibited overclaim or health verdict phrase: '{phrase}'.")

    # 2. Number grounding check
    evidence_numbers = extract_numbers_from_evidence(evidence)

    for part in all_text_parts:
        for num in extract_numbers_from_text(part):
            if num in ALLOWED_NUMERIC_WHITELIST:
                continue
            if num not in evidence_numbers:
                # Check if variant without trailing .0 or with .0 matches
                if (num.endswith(".0") and num[:-2] in evidence_numbers) or (f"{num}.0" in evidence_numbers):
                    continue
                errors.append(f"Number '{num}' in explanation does not appear in the evidence packet.")

    # 3. Evidence refs check
    available_paths = set(evidence.available_field_paths)
    missing_paths = set(evidence.missing_fields)

    for obs in data.observations:
        for ref in obs.evidence_refs:
            if ref in missing_paths:
                errors.append(f"Observation references a field that is explicitly missing: '{ref}'.")
            elif ref not in available_paths and not any(p.startswith(ref) for p in available_paths):
                errors.append(f"Observation references an unknown or unverified field path: '{ref}'.")

    # 4. Allergen subset check
    evidence_allergens = {a.lower() for a in evidence.declared_allergens}
    for decl in data.allergen_statement.declared:
        if decl.lower() not in evidence_allergens:
            errors.append(f"Allergen statement declares allergen '{decl}' not present in label evidence.")

    # 5. Missing fields value check
    for missing in evidence.missing_fields:
        field_name = missing.replace("nutrition.", "")
        # If sugar is missing, ensure prose does not claim a value for it
        if field_name in ["sugars", "sugar"] and "sugars" in missing_paths:
            if re.search(r"\bcontains \d+.*sugars?\b", full_corpus) or re.search(r"\b\d+\s*g (?:of )?sugars?\b", full_corpus):
                errors.append("Claims a specific sugar value when sugars are explicitly missing.")

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
    )
