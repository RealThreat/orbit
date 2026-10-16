import { Gamepad2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components";
import { SettingsIntegrationCard } from "./settings-integration-card";

export function SettingsConsoleAccounts() {
  const { t } = useTranslation("console_accounts");
  const navigate = useNavigate();
  return (
    <SettingsIntegrationCard
      title="PlayStation & Xbox"
      logo={<Gamepad2 size={24} />}
      status={t("experimental")}
      actions={
        <Button
          theme="outline"
          onClick={() => navigate("/console-achievements")}
        >
          {t("configure")}
        </Button>
      }
    >
      <p>{t("description")}</p>
      <p>PS3 · PS4 · PS5 · Xbox 360 · Xbox One · Xbox Series X|S</p>
    </SettingsIntegrationCard>
  );
}
