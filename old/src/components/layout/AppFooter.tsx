import { useTranslation } from "react-i18next";
import { Scale } from "lucide-react";

export default function AppFooter() {
  const { t } = useTranslation("app");
  return (
    <footer className="border-t mt-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 text-sm text-muted-foreground">
        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <span>{t("title")}</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="flex items-center gap-1">
            <Scale className="h-3 w-3" />
            MIT License
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span>{t("footer.unofficial")}</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="font-mono">{__APP_VERSION__}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground/60 text-center pb-3">
        {t("footer.trademark")}
      </div>
    </footer>
  );
}
