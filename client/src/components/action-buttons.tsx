import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface ActionButtonsProps {
  onAccept: () => void;
  onReject: () => void;
  isLoading: boolean;
}

export default function ActionButtons({
  onAccept,
  onReject,
  isLoading,
}: ActionButtonsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-4"
    >
      <Button
        variant="default"
        className="flex-1"
        onClick={onAccept}
        disabled={isLoading}
      >
        <Check className="w-4 h-4 mr-2" />
        Accept Changes
      </Button>
      <Button
        variant="destructive"
        className="flex-1"
        onClick={onReject}
        disabled={isLoading}
      >
        <X className="w-4 h-4 mr-2" />
        Reject
      </Button>
    </motion.div>
  );
}
