import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTheme } from "../ui/theme-provider";
import { Sun, Moon } from "lucide-react";

interface AppHeaderProps {
  onLanguageChange: (lang: string) => void;
}

export default function AppHeader({ onLanguageChange }: AppHeaderProps) {
  const { t, i18n } = useTranslation("app");
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      {/* Header bar with title and controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9 p-0"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Language selector */}
          <Select value={i18n.language} onValueChange={onLanguageChange}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="zh-Hans">简体中文</SelectItem>
              <SelectItem value="zh-Hant">繁體中文</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
              <SelectItem value="ko">한국어</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="ru">Русский</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
