import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";

export default function ScreenshotPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="bg-muted p-4 aspect-video flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Mock screenshot of Cursor IDE changes would appear here
        </p>
      </Card>
    </motion.div>
  );
}
