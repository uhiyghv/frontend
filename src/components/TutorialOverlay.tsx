import { useTutorialContext } from "@/contexts/TutorialContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, ChevronLeft, ChevronRight, Sparkles, MousePointer } from "lucide-react";
import { useEffect, useState } from "react";

export function TutorialOverlay() {
  const {
    isOpen,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    prevStep,
    skipTutorial,
    closeTutorial,
  } = useTutorialContext();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isOpen || !currentStepData?.target) {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      const target = document.querySelector(currentStepData.target!);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    findTarget();
    const interval = setInterval(findTarget, 500);

    return () => clearInterval(interval);
  }, [isOpen, currentStepData]);

  if (!isOpen || !currentStepData) return null;

  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;
  const isCentered = currentStepData.position === "center" || !targetRect;

  const getCardPosition = () => {
    if (isCentered) return {};

    const padding = 16;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const cardWidth = Math.min(400, vw - padding * 2);
    const estimatedCardHeight = 320;

    const clampX = (x: number) =>
      Math.max(padding, Math.min(x, vw - cardWidth - padding));
    const clampY = (y: number) =>
      Math.max(padding, Math.min(y, vh - estimatedCardHeight - padding));

    let left: number;
    let top: number;

    switch (currentStepData.position) {
      case "right": {
        const fitsRight = targetRect!.right + padding + cardWidth <= vw;
        left = fitsRight
          ? targetRect!.right + padding
          : Math.max(padding, targetRect!.left - cardWidth - padding);
        top = targetRect!.top;
        break;
      }
      case "bottom":
      default: {
        left = targetRect!.left - cardWidth / 2 + targetRect!.width / 2;
        top = targetRect!.bottom + padding;
        break;
      }
    }

    return {
      left: `${clampX(left)}px`,
      top: `${clampY(top)}px`,
      width: `${cardWidth}px`,
    };
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop with cutout */}
      <div className="absolute inset-0" onClick={closeTutorial} />
      
      {/* Highlight box */}
      {targetRect && !isCentered && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
          style={{
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
          }}
        />
      )}

      {/* Tutorial Card */}
      <Card
        className={`absolute z-10 w-full max-w-md shadow-2xl border-2 animate-scale-in ${
          isCentered ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : ""
        }`}
        style={isCentered ? {} : getCardPosition()}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">
                Passo {currentStep + 1} di {totalSteps}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeTutorial}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-1 mt-3" />
        </CardHeader>

        <CardContent className="pt-4">
          <CardTitle className="text-xl mb-3">{currentStepData.title}</CardTitle>
          <p className="text-muted-foreground leading-relaxed">{currentStepData.description}</p>
          {currentStepData.action && (
            <div className="flex items-center gap-2 mt-4 text-sm text-primary font-medium">
              <MousePointer className="h-4 w-4" />
              {currentStepData.action}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-3 pt-2">
          <div>
            {!isFirstStep && (
              <Button variant="ghost" onClick={prevStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Indietro
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!isLastStep && (
              <Button variant="ghost" onClick={skipTutorial}>Salta</Button>
            )}
            <Button onClick={nextStep}>
              {isLastStep ? "Inizia" : (<>Avanti<ChevronRight className="h-4 w-4 ml-1" /></>)}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
