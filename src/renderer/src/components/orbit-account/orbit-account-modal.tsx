import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../modal/modal";
import { Button } from "../button/button";
import { TextField } from "../text-field/text-field";
import type { OrbitAccountAction } from "../../../../types/orbit-account.types";
import "./orbit-account-modal.scss";

export function OrbitAccountModal() {
  const { t } = useTranslation("orbit_account");
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<OrbitAccountAction>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () =>
      window.electron.onOrbitAuthRequest((page) => {
        setAction(
          page === "/update-email"
            ? "update-email"
            : page === "/update-password"
              ? "update-password"
              : "sign-in"
        );
        setEmail("");
        setPassword("");
        setCode("");
        setDisplayName("");
        setMessage("");
        setError("");
        setConfigured(null);
        setVisible(true);
        window.electron
          .getOrbitAccountStatus()
          .then(({ configured }) => setConfigured(configured))
          .catch(() => setConfigured(false));
      }),
    []
  );
  const changeAction = (next: OrbitAccountAction) => {
    setAction(next);
    setPassword("");
    setCode("");
    setMessage("");
    setError("");
  };
  const close = () => {
    if (!busy) {
      setVisible(false);
      setPassword("");
      setCode("");
    }
  };
  return (
    <Modal
      className="orbit-account-dialog"
      visible={visible}
      onClose={close}
      title={t("title")}
      description={t("description")}
    >
      <form
        className="orbit-account"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !configured) return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await window.electron.submitOrbitAccount({
              action,
              email,
              password,
              displayName,
              code,
            });
            setPassword("");
            setCode("");
            if (!result.ok) setError(t(`errors.${result.error}`));
            else if (result.status === "signed-in") setVisible(false);
            else {
              setMessage(t(result.status));
              if (action === "sign-up") setAction("verify");
              if (action === "recover") setAction("recover-verify");
            }
          } catch {
            setError(t("errors.network"));
          } finally {
            setBusy(false);
          }
        }}
      >
        {configured === false && (
          <p className="orbit-account__notice">{t("not_configured")}</p>
        )}
        {configured === true && (
          <p className="orbit-account__notice">{t("service_scope")}</p>
        )}
        <h3>{t(`actions.${action}`)}</h3>
        {action !== "update-password" && (
          <TextField
            label={t("email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            maxLength={254}
          />
        )}
        {action === "sign-up" && (
          <TextField
            label={t("display_name")}
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            required
            disabled={busy}
          />
        )}
        {["verify", "recover-verify"].includes(action) && (
          <TextField
            label={t("code")}
            autoComplete="one-time-code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            pattern="[0-9]{6,10}"
            disabled={busy}
          />
        )}
        {["sign-in", "sign-up", "update-password", "recover-verify"].includes(
          action
        ) && (
          <TextField
            label={t("password")}
            type="password"
            autoComplete={
              action === "sign-in" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={action === "sign-in" ? 1 : 12}
            maxLength={128}
            disabled={busy}
            hint={action !== "sign-in" ? t("password_hint") : undefined}
          />
        )}
        {error && (
          <p role="alert" className="orbit-account__error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="orbit-account__notice">
            {message}
          </p>
        )}
        <Button type="submit" disabled={busy || !configured}>
          {busy ? t("busy") : t(`actions.${action}`)}
        </Button>
        <div className="orbit-account__links">
          {action !== "sign-in" && (
            <Button
              theme="outline"
              size="small"
              disabled={busy}
              onClick={() => changeAction("sign-in")}
            >
              {t("actions.sign-in")}
            </Button>
          )}
          {action === "sign-in" && (
            <>
              <Button
                theme="outline"
                disabled={busy}
                onClick={() => changeAction("sign-up")}
              >
                {t("actions.sign-up")}
              </Button>
              <Button
                theme="outline"
                disabled={busy}
                onClick={() => changeAction("recover")}
              >
                {t("forgot")}
              </Button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
