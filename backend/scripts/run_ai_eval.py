"""Mode B Live Model Evaluation Script.

Calls the REAL Gemini model for each of the 12 golden evidence packets,
runs the veracity and policy validator, and generates docs/ai-eval-report.md.

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
from app.services.ai_validator import validate_explanation
from app.services.evidence import serialize_evidence_packet
from app.services.gemini_client import gemini_client
from app.services.prompts import PROMPT_VERSION, SYSTEM_INSTRUCTION, build_user_prompt
from tests.eval.test_ai_eval import GOLDEN_PACKETS


async def run_live_eval():
    parser = argparse.ArgumentParser(description="Ingrivo AI Evaluation Runner")
    parser.add_argument("--yes", action="store_true", help="Explicit confirmation to consume real Gemini quota")
    args = parser.parse_args()

    if not args.yes:
        print("WARNING: This script calls the REAL Gemini API and consumes quota (approx. 12-24 calls).")
        print("To proceed, re-run with: python scripts/run_ai_eval.py --yes")
        sys.exit(1)

    if not settings.gemini_configured:
        print("FAIL: Gemini is not configured in backend/.env. Cannot run live evaluation.")
        sys.exit(1)

    print(f"Starting AI Evaluation Suite against model: {settings.GEMINI_MODEL} ...")
    results = []
    total = len(GOLDEN_PACKETS)
    passed_count = 0

    for i, case in enumerate(GOLDEN_PACKETS, 1):
        cid = case["id"]
        cname = case["name"]
        packet = case["packet"]
        serialized = serialize_evidence_packet(packet)
        user_prompt = build_user_prompt(serialized)

        print(f"[{i}/{total}] Evaluating: {cid} ({cname}) ...", end=" ", flush=True)

        try:
            # Attempt 1
            parsed_data, meta = await gemini_client.generate_structured(
                system_instruction=SYSTEM_INSTRUCTION,
                user_prompt=user_prompt,
                response_schema=ExplainStructuredData,
                timeout_seconds=25,
            )
            val = validate_explanation(parsed_data, packet)
            retried = False

            if not val.is_valid:
                # Retry once
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
                    "passed": True,
                    "retried": retried,
                    "errors": [],
                    "latency_ms": meta.get("latency_ms"),
                })
            else:
                print(f"FAIL: {val.errors}")
                results.append({
                    "id": cid,
                    "name": cname,
                    "passed": False,
                    "retried": retried,
                    "errors": val.errors,
                    "latency_ms": meta.get("latency_ms"),
                })

        except Exception as e:
            print(f"ERROR: {type(e).__name__} - {e}")
            results.append({
                "id": cid,
                "name": cname,
                "passed": False,
                "retried": False,
                "errors": [f"Exception: {str(e)}"],
                "latency_ms": 0,
            })

    # Generate Markdown Report
    pass_rate = round((passed_count / total) * 100, 1)
    report_content = f"""# AI Model Evaluation Report

- **Date**: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
- **Model Evaluated**: `{settings.GEMINI_MODEL}`
- **Prompt Version**: `{PROMPT_VERSION}`
- **Overall Pass Rate**: **{passed_count}/{total} ({pass_rate}%)**

---

## 1. Summary of Results

| Case ID | Product Scenario | Result | Retried | Latency (ms) | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
"""

    for r in results:
        res_str = "✅ PASS" if r["passed"] else "❌ FAIL"
        retry_str = "Yes" if r["retried"] else "No"
        notes = "; ".join(r["errors"]) if r["errors"] else "Verified zero ungrounded claims"
        report_content += f"| `{r['id']}` | {r['name']} | {res_str} | {retry_str} | {r['latency_ms']} | {notes} |\n"

    report_content += """
---

## 2. Veracity & Policy Invariants Verified

1. **Number Grounding**: Every number in prose fields appears in the input evidence packet or standard whitelist ("per 100 g").
2. **Missing Stays Missing**: Missing nutrients (e.g. unstated sugar, missing fibre) are never given inferred values.
3. **No Health Verdicts**: Prohibited health verdict phrases ("healthy", "superfood", "cures", "toxic") strictly rejected.
4. **Prompt Injection Immunity**: Instructions embedded in ingredients data blocks are treated as passive data.
5. **No Hallucinated Allergens**: Only allergens listed in the evidence packet are declared in the output.
"""

    report_path = Path(__file__).resolve().parent.parent.parent / "docs" / "ai-eval-report.md"
    report_path.write_text(report_content, encoding="utf-8")
    print(f"\nReport written to: {report_path}")
    print(f"Final Score: {passed_count}/{total} passed ({pass_rate}%)")


if __name__ == "__main__":
    asyncio.run(run_live_eval())
