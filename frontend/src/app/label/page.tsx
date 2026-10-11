import { FlaggedFeaturePlaceholder } from "@/components/FlaggedFeaturePlaceholder";

export default function LabelPage() {
  return (
    <FlaggedFeaturePlaceholder
      featureTitle="Label Photo OCR"
      featureDescription="On-device OCR and label parsing for ingredient lists and nutrition tables directly from food packaging photos."
      plannedPhase="Phase 4 (Label OCR & Browser Parsing)"
    />
  );
}
