import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Gamepad2,
  Trophy,
  RefreshCw,
  ChevronLeft,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@renderer/components";
import { SettingsIntegrationCard } from "../settings/settings-integration-card";
import type {
  ConsoleAccount,
  ConsoleAchievement,
  ConsoleProvider,
  ConsoleResult,
  ConsoleTitle,
} from "@types";
import "./console-achievements.scss";
import { GamePlatformProgress } from "@renderer/components/game-platform-progress/game-platform-progress";
import { consoleProgressId } from "@renderer/components/game-platform-progress/progress-model";

const initialAccounts: ConsoleAccount[] = ["psn", "xbox"].map((provider) => ({
  provider: provider as ConsoleProvider,
  configured: false,
  connected: false,
  titles: [],
}));
const providerName = (provider: ConsoleProvider) =>
  provider === "psn" ? "PlayStation Network" : "Xbox";

export default function ConsoleAchievements() {
  const { t, i18n } = useTranslation("console_accounts");
  const [accounts, setAccounts] = useState(initialAccounts);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ConsoleProvider | null>(null);
  const [error, setError] = useState("");
  const [showPsn, setShowPsn] = useState(false);
  const [npsso, setNpsso] = useState("");
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [selected, setSelected] = useState<{
    accountId: string;
    title: ConsoleTitle;
  } | null>(null);
  const [achievements, setAchievements] = useState<ConsoleAchievement[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void window.electron
      .getConsoleAccounts()
      .then((result) => {
        if (!mounted.current) return;
        if (result.ok) setAccounts(result.data);
        else setError(t(`errors.${result.error}`));
      })
      .catch(() => {
        if (mounted.current) setError(t("errors.network"));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [t]);

  const run = useCallback(
    async (
      source: ConsoleProvider,
      action: () => Promise<ConsoleResult<ConsoleAccount>>,
      scan = false
    ) => {
      setBusy(source);
      setError("");
      setSelected(null);
      try {
        const result = await action();
        if (!mounted.current) return;
        if (!result.ok) {
          setError(t(`errors.${result.error}`));
          return;
        }
        const update = (account: ConsoleAccount) =>
          setAccounts((previous) =>
            previous.map((item) => (item.provider === source ? account : item))
          );
        update(result.data);
        if (source === "psn") {
          setShowPsn(false);
          setNpsso("");
        }
        if (scan && result.data.accountId) {
          const sync = await window.electron.syncConsoleAccount(
            source,
            result.data.accountId
          );
          if (!mounted.current) return;
          if (sync.ok) update(sync.data);
          else setError(t(`errors.${sync.error}`));
        }
      } catch {
        if (mounted.current) setError(t("errors.network"));
      } finally {
        if (mounted.current) {
          setBusy(null);
          setNpsso("");
        }
      }
    },
    [t]
  );

  useEffect(() => {
    if (!selected) {
      setDetailsLoading(false);
      return;
    }
    let current = true;
    setDetailsLoading(true);
    setAchievements([]);
    setError("");
    void window.electron
      .getConsoleAchievements(
        selected.title.provider,
        selected.accountId,
        selected.title.id
      )
      .then((result) => {
        if (!current) return;
        if (result.ok) {
          setAchievements(result.data);
          void window.electron
            .getConsoleAccounts()
            .then((state) => {
              if (current && state.ok) setAccounts(state.data);
            })
            .catch(() => {});
        } else setError(t(`errors.${result.error}`));
      })
      .catch(() => {
        if (current) setError(t("errors.network"));
      })
      .finally(() => {
        if (current) setDetailsLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selected, t]);

  const titles = accounts.flatMap((account) =>
    account.titles.map((title) => ({ title, accountId: account.accountId! }))
  );
  const platforms = [
    ...new Set(titles.flatMap(({ title }) => title.platforms)),
  ].sort();
  const visible = titles.filter(
    ({ title }) =>
      (provider === "all" || title.provider === provider) &&
      (platform === "all" || title.platforms.includes(platform)) &&
      title.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );

  return (
    <div className="console-achievements">
      <header className="console-achievements__header">
        <div>
          <p className="console-achievements__eyebrow">
            Orbit · {t("experimental")}
          </p>
          <h1>
            <Trophy size={28} />
            {t("title")}
          </h1>
          <p>{t("description")}</p>
        </div>
      </header>
      <div className="console-achievements__connections">
        {accounts.map((account) => (
          <SettingsIntegrationCard
            key={account.provider}
            title={providerName(account.provider)}
            logo={<Gamepad2 size={24} />}
            loading={loading}
            status={t(
              account.connected
                ? "connected"
                : account.titles.length
                  ? "snapshot"
                  : "disconnected"
            )}
            statusTone={account.connected ? "success" : "neutral"}
            actions={
              <>
                <Button
                  theme="outline"
                  disabled={!!busy || loading || !account.configured}
                  onClick={() =>
                    account.provider === "psn"
                      ? setShowPsn(true)
                      : void run(
                          "xbox",
                          () => window.electron.connectXbox(),
                          true
                        )
                  }
                >
                  {busy === account.provider
                    ? t("working")
                    : t(account.connected ? "change_account" : "connect")}
                </Button>
                {account.connected && (
                  <>
                    <Button
                      disabled={!!busy}
                      onClick={() =>
                        void run(account.provider, () =>
                          window.electron.syncConsoleAccount(
                            account.provider,
                            account.accountId!
                          )
                        )
                      }
                    >
                      <RefreshCw size={14} />
                      {t("scan")}
                    </Button>
                    <Button
                      theme="outline"
                      disabled={!!busy}
                      onClick={() =>
                        void run(account.provider, () =>
                          window.electron.disconnectConsoleAccount(
                            account.provider,
                            account.accountId!
                          )
                        )
                      }
                    >
                      {t("disconnect")}
                    </Button>
                  </>
                )}
              </>
            }
          >
            <p>
              {account.provider === "psn"
                ? "PS3 · PS4 · PS5"
                : "Xbox 360 · Xbox One · Xbox Series X|S"}
            </p>
            {account.displayName && <strong>{account.displayName}</strong>}
            {!account.configured && !loading && (
              <p>{t("xbox_setup_required")}</p>
            )}
            {account.lastSyncedAt && (
              <p className="console-achievements__muted">
                {t("last_synced", {
                  date: new Date(account.lastSyncedAt).toLocaleString(
                    i18n.language
                  ),
                })}
              </p>
            )}
            {!account.connected && !!account.titles.length && (
              <p className="console-achievements__muted">
                {t("snapshot_kept")}
              </p>
            )}
          </SettingsIntegrationCard>
        ))}
      </div>

      {showPsn && (
        <form
          className="console-achievements__panel console-achievements__psn"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "psn",
              () => window.electron.connectPlayStation(npsso.trim()),
              true
            );
          }}
        >
          <h2>{t("psn_connect")}</h2>
          <p>{t("psn_instructions")}</p>
          <div className="console-achievements__actions">
            <Button
              theme="outline"
              type="button"
              onClick={() =>
                window.electron.openExternal("https://www.playstation.com/")
              }
            >
              {t("psn_signin")}
            </Button>
            <Button
              theme="outline"
              type="button"
              onClick={() =>
                window.electron.openExternal(
                  "https://ca.account.sony.com/api/v1/ssocookie"
                )
              }
            >
              {t("psn_token")}
            </Button>
          </div>
          <label>
            {t("psn_token_label")}
            <input
              type="password"
              disabled={!!busy}
              autoComplete="off"
              spellCheck={false}
              value={npsso}
              onChange={(event) => setNpsso(event.target.value)}
              maxLength={64}
              placeholder="NPSSO"
            />
          </label>
          <p className="console-achievements__muted">
            <LockKeyhole size={14} />
            {t("token_private")}
          </p>
          <div className="console-achievements__actions">
            <Button
              type="submit"
              disabled={!!busy || npsso.trim().length !== 64}
            >
              {t("connect_and_scan")}
            </Button>
            <Button
              theme="outline"
              type="button"
              disabled={!!busy}
              onClick={() => {
                setShowPsn(false);
                setNpsso("");
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="console-achievements__error">
          {error}
        </p>
      )}

      {selected ? (
        <section className="console-achievements__panel">
          <Button theme="outline" onClick={() => setSelected(null)}>
            <ChevronLeft size={16} />
            {t("back")}
          </Button>
          <div className="console-achievements__section-heading">
            <h2>{selected.title.title}</h2>
            <span>{selected.title.platforms.join(" · ")}</span>
          </div>
          <GamePlatformProgress
            anchorId={consoleProgressId(
              selected.title.provider,
              selected.accountId,
              selected.title.id
            )}
            title={selected.title.title}
            accounts={accounts}
          />
          {detailsLoading ? (
            <p role="status">{t("loading")}</p>
          ) : error ? (
            <Button
              theme="outline"
              onClick={() => setSelected({ ...selected })}
            >
              {t("retry")}
            </Button>
          ) : (
            <>
              <p>
                {t("achievement_count", {
                  earned: achievements.filter((item) => item.earned).length,
                  total: achievements.length,
                })}
              </p>
              <div className="console-achievements__details">
                {achievements.map((item) => (
                  <article
                    key={item.id}
                    className={`console-achievements__achievement ${item.earned ? "console-achievements__achievement--earned" : ""}`}
                  >
                    <Trophy size={20} />
                    <div>
                      <h3>
                        {item.hidden && !item.earned
                          ? t("secret")
                          : item.name || t("secret")}
                      </h3>
                      <p>
                        {item.hidden && !item.earned
                          ? t("secret_description")
                          : item.description}
                      </p>
                      {item.earnedAt && (
                        <span>
                          {new Date(item.earnedAt).toLocaleString(
                            i18n.language
                          )}
                        </span>
                      )}
                    </div>
                    <span className="console-achievements__reward">
                      {item.trophyType
                        ? t(`trophy.${item.trophyType}`)
                        : `${item.gamerscore ?? 0} G`}
                      <br />
                      {t(item.earned ? "earned" : "locked")}
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <section>
          <div className="console-achievements__section-heading">
            <h2>{t("games", { count: titles.length })}</h2>
            <p>{t("synced_only")}</p>
          </div>
          <div className="console-achievements__filters">
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label={t("provider")}
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            >
              <option value="all">{t("all_accounts")}</option>
              <option value="psn">PlayStation</option>
              <option value="xbox">Xbox</option>
            </select>
            <select
              aria-label={t("platform")}
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              <option value="all">{t("all_platforms")}</option>
              {platforms.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="console-achievements__games">
            {visible.map((item) => (
              <button
                key={item.title.id}
                className="console-achievements__game"
                disabled={!!busy}
                onClick={() => setSelected(item)}
              >
                <div className="console-achievements__cover">
                  {item.title.iconUrl ? (
                    <img
                      src={item.title.iconUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <Gamepad2 size={40} />
                  )}
                </div>
                <div>
                  <span className="console-achievements__muted">
                    {item.title.platforms.join(" · ")}
                  </span>
                  <h3>{item.title.title}</h3>
                  <p>
                    {item.title.total === null
                      ? t("earned_count", { count: item.title.earned })
                      : t("achievement_count", {
                          earned: item.title.earned,
                          total: item.title.total,
                        })}
                    {item.title.gamerscore !== undefined &&
                      ` · ${item.title.gamerscore} G`}
                  </p>
                  {item.title.total !== null && item.title.total > 0 && (
                    <progress
                      aria-label={item.title.title}
                      value={item.title.earned}
                      max={item.title.total}
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
          {!visible.length && (
            <p className="console-achievements__empty">
              {t(loading ? "loading" : titles.length ? "no_results" : "empty")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
