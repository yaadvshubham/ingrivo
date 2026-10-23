"""Mode B Live Model Evaluation Script (Phase 7 & Phase 8).

Calls the REAL Gemini model for each of the 12 golden evidence packets
and 4 comparison golden cases, runs the veracity and policy validator,
and generates docs/ai-eval-report.md.

Requires:
  python scripts/run_ai_eval.py --yes
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.schemas.analysis import ExplainStructuredData
from app.schemas.compare import CompareAiStructuredData
from app.services.ai_validator import validate_explanation
from app.services.compare import (
    COMPARE_SYSTEM_INSTRUCTION,
    build_deterministic_comparison,
    serialize_comparison_packet,
    validate_compare_narrative,
)
from app.services.evidence import serialize_evidence_packet
from app.services.gemini_client import gemini_client
from app.services.prompts import PROMPT_VERSION, SYSTEM_INSTRUCTION, build_user_prompt
from tests.eval.test_ai_eval import COMPARE_GOLDEN_CASES, GOLDEN_PACKETS


async def run_live_eval():
    parser = argparse.ArgumentParser(description="Ingrivo AI Evaluation Runner")
    parser.add_argument("--yes", action="store_true", help="Explicit confirmation to consume real Gemini quota")
    args = parser.parse_args()

    if not args.yes:
        print("WARNING: This script calls the REAL Gemini API and consumes quota (approx. 16-32 calls).")
        print("To proceed, re-run with: python scripts/run_ai_eval.py --yes")
        sys.exit(1)

    if not settings.gemini_configured:
        print("FAIL: Gemini is not configured in backend/.env. Cannot run live evaluation.")
        sys.exit(1)

    print(f"Starting AI Evaluation Suite against model: {settings.GEMINI_MODEL} ...")
    results = []
    total = len(GOLDEN_PACKETS) + len(COMPARE_GOLDEN_CASES)
    passed_count = 0

    # 1. Product Explanation Golden Packets
    print("\n--- Part 1: Product Explanation Golden Packets (12 Cases) ---")
    for i, case in enumerate(GOLDEN_PACKETS, 1):
        cid = case["id"]
        cname = case["name"]
        packet = case["packet"]
        serialized = serialize_evidence_packet(packet)
        user_prompt = build_user_prompt(serialized)

        print(f"[{i}/{total}] Evaluating: {cid} ({cname}) ...", end=" ", flush=True)

        try:
            parsed_data, meta = await gemini_client.generate_structured(
                system_instruction=SYSTEM_INSTRUCTION,
                user_prompt=user_prompt,
                response_schema=ExplainStructuredData,
                timeout_seconds=25,
            )
            val = validate_explanation(parsed_data, packet)
            retried = False

            if not val.is_valid:
                retried = True
                feedback = "\n".join(f"- {err}" for err in val.errors)
                retry_prompt = build_user_prompt(serialized, retry_feedback=feedback)
                parsed_data, meta = await gemini_client.generate_structured(
                    system_instruction=SYSTEM_INSTRUCTION,
                    user_prompt=retry_prompt,
                    response_schema=ExplainStructuredData,
                    timeout_seconds=25,
                )
                val = validate_explanation(parsed_data, packet)

            if val.is_valid:
                passed_count += 1
                status = "PASS (Retried)" if retried else "PASS"
                print(f"{status} ({meta.get('latency_ms')} ms)")
                results.append({
                    "id": cid,
                    "name": cname,
                    "type": "Product Explanation",
                    "passed": True,
                    "retried": retried,
                    "errors": [],
                    "latency_ms": meta.get("latency_ms", 0),
                })
            else:
                print(f"FAIL: {val.errors}")
                results.append({
                    "id": cid,
                    "name": cname,
                    "type": "Product Explanation",
                    "passed": False,
                    "retried": retried,
                    "errors": val.errors,
                    "latency_ms": meta.get("latency_ms", 0),
                })
        except Exception as e:
            print(f"ERROR: {str(e)}")
            results.append({
                "id": cid,
                "name": cname,
                "type": "Product Explanation",
                "passed": False,
                "retried": False,
                "errors": [str(e)],
                "latency_ms": 0,
            })

    # 2. Product Comparison Golden Cases (Phase 8)
    print("\n--- Part 2: Product Comparison Golden Cases (4 Cases) ---")
    start_idx = len(GOLDEN_PACKETS)
    for i, case in enumerate(COMPARE_GOLDEN_CASES, start_idx + 1):
        cid = case["id"]
        cname = case["name"]
        prod_a = case["prod_a"]
        prod_b = case["prod_b"]

        summary_a, summary_b, rows, ing_diff, allergen_diff = build_deterministic_comparison(prod_a, prod_b)
        serialized_packet = serialize_comparison_packet(summary_a, summary_b, rows, ing_diff, allergen_diff)
        user_prompt = f"""Please narrate the factual differences between these two products based solely on the computed comparison data below.
<<<COMPARISON_DATA_START>>>
{serialized_packet}
<<<COMPARISON_DATA_END>>>
"""

        print(f"[{i}/{total}] Evaluating: {cid} ({cname}) ...", end=" ", flush=True)

        try:
            parsed_data, meta = await gemini_client.generate_structured(
                system_instruction=COMPARE_SYSTEM_INSTRUCTION,
                user_prompt=user_prompt,
                response_schema=CompareAiStructuredData,
                timeout_seconds=25,
            )
            val = validate_compare_narrative(parsed_data, serialized_packet, rows)
            retried = False

            if not val.is_valid:
                retried = True
                feedback = "\n".join(f"- {err}" for err in val.errors)
                retry_prompt = f"""{user_prompt}

IMPORTANT CORRECTION: Your previous attempt failed our validation suite with the following errors:
{feedback}

Please regenerate the structured output ensuring no ranking language (better, worse, healthier, etc.), all numbers match computed differences, and evidence_refs point to valid paths.
"""
                parsed_data, meta = await gemini_client.generate_structured(
                    system_instruction=COMPARE_SYSTEM_INSTRUCTION,
                    user_prompt=retry_prompt,
                    response_schema=CompareAiStructuredData,
                    timeout_seconds=25,
                )
                val = validate_compare_narrative(parsed_data, serialized_packet, rows)

            if val.is_valid:
                passed_count += 1
                status = "PASS (Retried)" if retried else "PASS"
                print(f"{status} ({meta.get('latency_ms')} ms)")
                results.append({
                    "id": cid,
                    "name": cname,
                    "type": "Product Comparison",
                    "passed": True,
                    "retried": retried,
                    "errors": [],
                    "latency_ms": meta.get("latency_ms", 0),
                })
            else:
                print(f"FAIL: {val.errors}")
                results.append({
                    "id": cid,
                    "name": cname,
                    "type": "Product Comparison",
                    "passed": False,
                    "retried": retried,
                    "errors": val.errors,
                    "latency_ms": meta.get("latency_ms", 0),
                })
        except Exception as e:
            print(f"ERROR: {str(e)}")
            results.append({
                "id": cid,
                "name": cname,
                "type": "Product Comparison",
                "passed": False,
                "retried": False,
                "errors": [str(e)],
                "latency_ms": 0,
            })

    # Generate Markdown Report
    pass_rate = round((passed_count / total) * 100, 1)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    report_content = f"""# AI Veracity & Safety Evaluation Report

- **Date Evaluated**: {timestamp}
- **Model Evaluated**: `{settings.GEMINI_MODEL}`
- **Overall Pass Rate**: **{passed_count}/{total} ({pass_rate}%)**

---

## 1. Summary of Results

| Case ID | Type | Scenario | Result | Retried | Latency (ms) | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
"""

    for r in results:
        res_str = "✅ PASS" if r["passed"] else "❌ FAIL"
        retry_str = "Yes" if r["retried"] else "No"
        notes = "; ".join(r["errors"]) if r["errors"] else "Verified zero ungrounded claims or ranking words"
        report_content += f"| `{r['id']}` | {r['type']} | {r['name']} | {res_str} | {retry_str} | {r['latency_ms']} | {notes} |\n"

    report_content += """
---

## 2. Veracity & Policy Invariants Verified

1. **Number Grounding**: Every number in prose fields appears in the input evidence packet or standard whitelist ("per 100 g").
2. **Missing Stays Missing**: Missing nutrients (e.g. unstated sugar, missing fibre) are never given inferred values.
3. **No Health Verdicts**: Prohibited health verdict phrases ("healthy", "superfood", "cures", "toxic") strictly rejected.
4. **No Comparison Ranking or Winners**: Words like "better", "worse", "healthier", "winner", "prefer", "should choose" are rejected. Only neutral "higher/lower per 100 g" permitted.
5. **Prompt Injection Immunity**: Instructions embedded in ingredients data blocks are treated as passive data.
6. **No Hallucinated Allergens**: Only allergens listed in the evidence packet are declared in the output.
"""

    report_path = Path(__file__).resolve().parent.parent.parent / "docs" / "ai-eval-report.md"
    report_path.write_text(report_content, encoding="utf-8")
    print(f"\nReport written to: {report_path}")
    print(f"Final Score: {passed_count}/{total} passed ({pass_rate}%)")


if __name__ == "__main__":
    asyncio.run(run_live_eval())
