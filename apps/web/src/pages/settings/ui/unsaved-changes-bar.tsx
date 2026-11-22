import { Button } from "@freenary/ui/components/button";
import { Elevated } from "@freenary/ui/lib/elevated";
import { spring } from "@freenary/ui/lib/springs";
import { AnimatePresence, motion } from "motion/react";

import { m } from "@/paraglide/messages.js";

interface UnsavedChangesBarProps {
  changeCount: number;
  hasErrors: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onReview?: () => void;
  onSave: () => void;
}

export const UnsavedChangesBar = ({
  changeCount,
  hasErrors,
  isSaving,
  onCancel,
  onReview,
  onSave,
}: UnsavedChangesBarProps) => (
  <AnimatePresence initial={false}>
    {changeCount > 0 && (
      <motion.div
        animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
        className="fixed inset-x-0 bottom-[calc(var(--bottom-tab-bar-height)+1rem)] z-50 mx-auto w-fit md:bottom-4"
        exit={{
          filter: "blur(4px)",
          opacity: 0,
          transition: spring.slow.exit,
          y: 12,
        }}
        initial={{ filter: "blur(4px)", opacity: 0, y: 12 }}
        transition={spring.slow}
      >
        <Elevated
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          offset={3}
        >
          <span className="text-muted-foreground px-1 text-xs font-medium">
            {m.settings_unsaved_change({ count: changeCount })}
          </span>
          {onReview ? (
            <Button onClick={onReview} variant="ghost">
              {m.settings_unsaved_review()}
            </Button>
          ) : null}
          <Button disabled={isSaving} onClick={onCancel} variant="ghost">
            {m.settings_cancel()}
          </Button>
          <Button
            disabled={isSaving || hasErrors}
            loading={isSaving}
            onClick={onSave}
          >
            {m.settings_save()}
          </Button>
        </Elevated>
      </motion.div>
    )}
  </AnimatePresence>
);
