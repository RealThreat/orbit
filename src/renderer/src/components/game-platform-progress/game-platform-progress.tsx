import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Trophy } from "lucide-react";
import { useLibrary } from "@renderer/hooks";
import { groupLibraryGames } from "@shared";
import type { ConsoleAccount, LibraryGame } from "@types";
import {
  consoleProgressEntries,
  linkedProgressEntries,
  parseProgressLinks,
  pcProgressEntry,
  pcProgressId,
  type ProgressLink,
} from "./progress-model";
import "./game-platform-progress.scss";

const STORAGE_KEY = "orbit.game-platform-links.v1";
const CHANGE_EVENT = "orbit-platform-links-changed";
interface Props {
  anchorId: string;
  title: string;
  currentGame?: LibraryGame | null;
  accounts?: ConsoleAccount[];
}
export function GamePlatformProgress({
  anchorId,
  title,
  currentGame,
  accounts: suppliedAccounts,
}: Props) {
  const { t, i18n } = useTranslation("platform_progress");
  const { library } = useLibrary();
  const [accounts, setAccounts] = useState<ConsoleAccount[]>(
    suppliedAccounts ?? []
  );
  const [links, setLinks] = useState<ProgressLink[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [accountError, setAccountError] = useState(false);
  const [loading, setLoading] = useState(!suppliedAccounts);
  const [search, setSearch] = useState("");
  const [choice, setChoice] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const read = () => {
      try {
        setLinks(parseProgressLinks(localStorage.getItem(STORAGE_KEY)));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(CHANGE_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(CHANGE_EVENT, read);
    };
  }, []);
  useEffect(() => {
    setChoice("");
    setSearch("");
    setNotice("");
  }, [anchorId]);
  useEffect(() => {
    if (suppliedAccounts) {
      setAccounts(suppliedAccounts);
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    setAccountError(false);
    void window.electron
      .getConsoleAccounts()
      .then((result) => {
        if (!current) return;
        if (result.ok) setAccounts(result.data);
        else setAccountError(true);
      })
      .catch(() => {
        if (current) setAccountError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [suppliedAccounts, anchorId]);
  const games = useMemo(() => {
    const available = library.filter((game) => !game.isDeleted);
    if (
      currentGame &&
      !available.some(
        (game) =>
          game.shop === currentGame.shop &&
          game.objectId === currentGame.objectId
      )
    )
      return [...available, currentGame];
    return available;
  }, [library, currentGame]);
  const entries = useMemo(() => {
    const available = [
      ...games.map(pcProgressEntry),
      ...consoleProgressEntries(accounts),
    ];
    if (!available.some((entry) => entry.id === anchorId)) {
      const shop = anchorId.split(":")[1];
      const labels: Record<string, string> = {
        steam: "Steam",
        epic: "Epic Games",
        custom: "Orbit",
        launchbox: "LaunchBox",
      };
      available.unshift({
        id: anchorId,
        title,
        platform: labels[shop] || t("current_version"),
        earned: null,
        total: null,
      });
    }
    return available;
  }, [games, accounts, anchorId, title, t]);
  const confirmedLinks = useMemo(
    () =>
      groupLibraryGames(games).flatMap((group): ProgressLink[] =>
        group.members
          .slice(1)
          .map((member) => [
            pcProgressId(group.members[0].shop, group.members[0].objectId),
            pcProgressId(member.shop, member.objectId),
          ])
      ),
    [games]
  );
  const rows = useMemo(
    () =>
      linkedProgressEntries(anchorId, entries, [...confirmedLinks, ...links]),
    [anchorId, entries, confirmedLinks, links]
  );
  const grouped = new Set(rows.map((row) => row.id));
  const candidates = entries
    .filter(
      (entry) =>
        !grouped.has(entry.id) &&
        entry.id !== anchorId &&
        entry.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    )
    .sort(
      (a, b) =>
        Number(b.title.toLocaleLowerCase() === title.toLocaleLowerCase()) -
          Number(a.title.toLocaleLowerCase() === title.toLocaleLowerCase()) ||
        a.title.localeCompare(b.title)
    );
  const associate = () => {
    if (
      !choice ||
      !candidates.some((entry) => entry.id === choice) ||
      storageError
    )
      return;
    try {
      // Re-read before writing so links added by another window are retained.
      const previous = parseProgressLinks(localStorage.getItem(STORAGE_KEY));
      const next: ProgressLink[] = previous.some(
        ([a, b]) =>
          (a === anchorId && b === choice) || (a === choice && b === anchorId)
      )
        ? previous
        : [...previous, [anchorId, choice]];
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, links: next })
      );
      setLinks(next);
      setChoice("");
      setNotice(t("associated"));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      setStorageError(true);
    }
  };
  const removeAssociation = (left: string, right: string) => {
    if (storageError || !window.confirm(t("remove_confirm"))) return;
    try {
      const previous = parseProgressLinks(localStorage.getItem(STORAGE_KEY));
      const next = previous.filter(([a, b]) => !(a === left && b === right));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, links: next })
      );
      setLinks(next);
      setNotice(t("removed"));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      setStorageError(true);
    }
  };
  return (
    <section className="platform-progress" aria-label={t("title")}>
      <header>
        <div>
          <h2>
            <Trophy size={19} />
            {t("title")}
          </h2>
          <p>{t("independent")}</p>
        </div>
        <a href="#/console-achievements">{t("manage_accounts")}</a>
      </header>
      {loading && <p role="status">{t("loading")}</p>}
      {accountError && <p role="status">{t("account_error")}</p>}
      <div className="platform-progress__rows">
        {rows.map((row) => {
          const known =
            row.earned !== null && row.total !== null && row.total > 0;
          const percent = known
            ? Math.min(100, Math.round((row.earned! / row.total!) * 100))
            : null;
          return (
            <article key={row.id}>
              <div className="platform-progress__label">
                <strong>{row.platform}</strong>
                <span>{row.title}</span>
                {row.lastSyncedAt && (
                  <small>
                    {t(row.snapshot ? "snapshot" : "synced", {
                      date: new Date(row.lastSyncedAt).toLocaleString(
                        i18n.language
                      ),
                    })}
                  </small>
                )}
              </div>
              <div className="platform-progress__numbers">
                <strong>
                  {row.earned !== null && row.total !== null
                    ? `${row.earned} / ${row.total}`
                    : row.earned !== null
                      ? t("earned_unknown_total", { count: row.earned })
                      : t("unknown")}
                </strong>
                {percent !== null && <span>{percent} %</span>}
                {known && (
                  <progress
                    aria-label={row.platform}
                    value={row.earned!}
                    max={row.total!}
                  />
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!rows.length && !loading && <p>{t("no_data")}</p>}
      <details className="platform-progress__associate">
        <summary>
          <Link2 size={15} />
          {t("associate")}
        </summary>
        <p>{t("associate_help")}</p>
        <div>
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setChoice("");
            }}
          />
          <select
            aria-label={t("version")}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            <option value="">{t("choose")}</option>
            {candidates.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.platform} — {entry.title}
                {entry.accountId ? ` · ${entry.accountId}` : ""}
              </option>
            ))}
          </select>
          <button disabled={!choice || storageError} onClick={associate}>
            {t("confirm")}
          </button>
        </div>
        {!candidates.length && <p>{t("no_candidates")}</p>}
      </details>
      {links
        .filter(([a, b]) => grouped.has(a) && grouped.has(b))
        .map(([a, b], index) => (
          <div
            className="platform-progress__manual-link"
            key={`${a}:${b}:${index}`}
          >
            <span>
              {entries.find((entry) => entry.id === a)?.platform} ↔{" "}
              {entries.find((entry) => entry.id === b)?.platform}
            </span>
            <button
              disabled={storageError}
              onClick={() => removeAssociation(a, b)}
            >
              {t("remove_link")}
            </button>
          </div>
        ))}
      {notice && <p role="status">{notice}</p>}
      {storageError && <p role="alert">{t("storage_error")}</p>}
    </section>
  );
}
