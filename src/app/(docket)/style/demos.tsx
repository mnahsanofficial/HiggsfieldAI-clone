"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CostMeter, type MeterState } from "@/components/ui/cost-meter";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";

export function SegmentedDemo() {
  const [aspect, setAspect] = useState("1:1");
  return (
    <Segmented
      name="aspect-demo"
      label="Aspect"
      value={aspect}
      onChange={setAspect}
      options={[
        { value: "1:1", label: "1:1" },
        { value: "16:9", label: "16:9" },
        { value: "9:16", label: "9:16" },
        { value: "4:3", label: "4:3" },
        { value: "3:4", label: "3:4", disabled: true },
      ]}
    />
  );
}

export function MeterDemo() {
  const [state, setState] = useState<MeterState>("idle");
  return (
    <div className="flex flex-col gap-3">
      <CostMeter costTenths={300} balanceTenths={700} state={state} />
      <div className="flex gap-2">
        <Button
          size="sm"
          pending={state === "committing"}
          onClick={() => {
            setState("committing");
            setTimeout(() => setState("idle"), 1600);
          }}
        >
          Render the move
        </Button>
      </div>
    </div>
  );
}

export function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open a sheet
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Choose a camera move">
        <p className="t-body pb-4">Sheets hold choices that belong to the page underneath: the move picker, the image picker, checkout. Escape, the close button and the backdrop all close it, and focus returns to what opened it.</p>
        <Button onClick={() => setOpen(false)}>Use this move</Button>
      </Sheet>
    </div>
  );
}
