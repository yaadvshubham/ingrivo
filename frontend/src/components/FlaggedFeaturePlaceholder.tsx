import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

interface FlaggedFeaturePlaceholderProps {
  featureTitle: string;
  featureDescription: string;
  plannedPhase: string;
}

export function FlaggedFeaturePlaceholder({
  featureTitle,
  featureDescription,
  plannedPhase,
}: FlaggedFeaturePlaceholderProps) {
  return (
    <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
      <Card className="border border-[#E4DEC3] bg-white shadow-xs">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#1B2A22]">
            {featureTitle} is coming soon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-[#5E6B63] leading-relaxed">
            {featureDescription}
          </p>
          <div className="rounded-lg bg-[#FBF8F2] border border-[#E4DEC3] p-3 text-xs text-[#5E6B63]">
            <span className="font-semibold text-[#1E5B45]">Development status: </span>
            Feature flag is currently disabled. Scheduled for activation in{" "}
            <span className="font-medium text-[#1B2A22]">{plannedPhase}</span>.
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className={buttonVariants({ variant: "outline" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to homepage
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
