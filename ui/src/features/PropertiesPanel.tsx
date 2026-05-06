import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { usePanel } from "../context/PanelContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function PropertiesPanel() {
  const { panelContent, panelVisible, setPanelVisible } = usePanel();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!!panelContent && panelVisible);
  }, [panelContent, panelVisible]);

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPanelVisible(false); }}>
      <SheetContent side="right" className="flex flex-col p-0 w-[340px]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/70">
              Side Panel
            </p>
            <span className="mt-1 block text-sm font-medium">Properties</span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={() => { setOpen(false); setPanelVisible(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">{panelContent}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
