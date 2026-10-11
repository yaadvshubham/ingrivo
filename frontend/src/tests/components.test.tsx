import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import { ProvenanceBadge, ProvenanceVariant } from "@/components/ProvenanceBadge";
import { MissingChip } from "@/components/MissingChip";
import { DataRow } from "@/components/DataRow";
import { DisabledAction } from "@/components/DisabledAction";
import { SampleBanner } from "@/components/SampleBanner";
import { Header } from "@/components/Header";
import HomePage from "@/app/page";

describe("Phase 2 Component & Accessibility Tests", () => {
  describe("ProvenanceBadge", () => {
    const variants: { variant: ProvenanceVariant; label: string }[] = [
      { variant: "source", label: "Source data" },
      { variant: "label", label: "From your label" },
      { variant: "ai", label: "AI explanation" },
      { variant: "derived", label: "Calculated" },
      { variant: "missing", label: "Not available" },
    ];

    variants.forEach(({ variant, label }) => {
      it(`renders visible text label "${label}" for variant "${variant}" (never color-only)`, () => {
        render(<ProvenanceBadge variant={variant} />);
        const badge = screen.getByTestId(`provenance-badge-${variant}`);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent(label);
      });
    });
  });

  describe("MissingChip", () => {
    it("renders neutral chip with accessible label and icon", () => {
      render(<MissingChip label="Not listed" />);
      const chip = screen.getByTestId("missing-chip");
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveTextContent("Not listed");
      // Must not contain red or danger classes
      expect(chip.className).not.toContain("red");
      expect(chip.className).not.toContain("danger");
    });
  });

  describe("DataRow", () => {
    it("shows MissingChip when value is null and never shows 0", () => {
      render(<DataRow label="Dietary Fiber" value={null} />);
      expect(screen.getByText("Dietary Fiber")).toBeInTheDocument();
      expect(screen.getByTestId("missing-chip")).toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("shows MissingChip when value is undefined and never shows 0", () => {
      render(<DataRow label="Potassium" value={undefined} />);
      expect(screen.getByText("Potassium")).toBeInTheDocument();
      expect(screen.getByTestId("missing-chip")).toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("correctly renders real numeric 0 as value", () => {
      render(<DataRow label="Added Sugars" value={0} unit="g" />);
      expect(screen.getByText("Added Sugars")).toBeInTheDocument();
      expect(screen.getByText("0 g")).toBeInTheDocument();
      expect(screen.queryByTestId("missing-chip")).not.toBeInTheDocument();
    });

    it("renders valid value with ProvenanceBadge", () => {
      render(
        <DataRow
          label="Total Fat"
          value="12"
          unit="g"
          provenance="source"
        />
      );
      expect(screen.getByText("Total Fat")).toBeInTheDocument();
      expect(screen.getByText("12 g")).toBeInTheDocument();
      expect(screen.getByTestId("provenance-badge-source")).toBeInTheDocument();
    });
  });

  describe("DisabledAction", () => {
    it("renders button with aria-disabled, visible 'Coming soon', and explanatory text", () => {
      render(
        <DisabledAction
          label="Scan a barcode"
          explanation="Feature currently in development."
        />
      );
      const button = screen.getByTestId("disabled-action-btn");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toBeDisabled();

      const badge = screen.getByTestId("coming-soon-badge");
      expect(badge).toHaveTextContent(/coming soon/i);

      const explanation = screen.getByTestId("disabled-action-explanation");
      expect(explanation).toHaveTextContent("Feature currently in development.");
    });
  });

  describe("App Shell Nav Landmarks", () => {
    it("renders accessible navigation landmark", () => {
      render(<Header />);
      const nav = screen.getByRole("navigation", { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
    });
  });

  describe("SampleBanner and Homepage", () => {
    it("renders SampleBanner wrapper with sample label", () => {
      render(
        <SampleBanner>
          <div>Sample inner content</div>
        </SampleBanner>
      );
      expect(
        screen.getByText("Sample, illustrative data, not a real product")
      ).toBeInTheDocument();
      expect(screen.getByText("Sample inner content")).toBeInTheDocument();
    });

    it("homepage renders SampleBanner around every sample section", () => {
      render(<HomePage />);
      const sampleTags = screen.getAllByTestId("sample-banner-tag");
      // Expect 2 sample banners: one for fictional insight card, one for fictional comparison preview
      expect(sampleTags.length).toBe(2);
      sampleTags.forEach((tag) => {
        expect(tag).toHaveTextContent(/sample, illustrative data, not a real product/i);
      });
    });
  });
});
