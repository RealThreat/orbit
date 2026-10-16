import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Trophy, Orbit, Gamepad2 } from "lucide-react";
import { useLibrary, useUserDetails, useAppSelector } from "@renderer/hooks";
import { buildGameDetailsPath } from "@renderer/helpers";
import type { LibraryGame } from "@types";
import { groupLibraryGames, getDisplayedPlayTimeInMilliseconds } from "@shared";
import "./home.scss";

export default function Home() {
  const { t, i18n } = useTranslation("home");
  const navigate = useNavigate();
  const { library } = useLibrary();
  const { userDetails } = useUserDetails();
  const hasLoaded = useAppSelector((state) => state.library.hasLoaded);
  const [query, setQuery] = useState("");
  const games = useMemo(() => groupLibraryGames(library), [library]);
  const recent = useMemo(
    () =>
      [...games]
        .filter((game) => game.lastTimePlayed)
        .sort(
          (a, b) =>
            new Date(b.lastTimePlayed!).getTime() -
            new Date(a.lastTimePlayed!).getTime()
        ),
    [games]
  );
  const featured = recent[0] ?? games[0];
  const visible = (
    query
      ? games.filter((game) =>
          game.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())
        )
      : recent.length
        ? recent
        : games
  ).slice(0, 5);
  const unplayed = games.filter(
    (game) => !getDisplayedPlayTimeInMilliseconds(game) && !game.lastTimePlayed
  );
  const totalTime = games.reduce(
    (total, game) => total + getDisplayedPlayTimeInMilliseconds(game),
    0
  );
  const completed = games.filter(
    (game) =>
      game.achievementCount &&
      (game.unlockedAchievementCount ?? 0) >= game.achievementCount
  );
  const progressing = games
    .filter(
      (game) =>
        game.achievementCount &&
        (game.unlockedAchievementCount ?? 0) > 0 &&
        (game.unlockedAchievementCount ?? 0) < game.achievementCount
    )
    .sort(
      (a, b) =>
        b.unlockedAchievementCount! / b.achievementCount! -
        a.unlockedAchievementCount! / a.achievementCount!
    )
    .slice(0, 3);
  const open = (game: LibraryGame) => navigate(buildGameDetailsPath(game));
  const hours = (ms: number) =>
    `${Math.floor(ms / 3600000).toLocaleString(i18n.language)} h`;
  const sources = ["steam", "epic", "custom", "launchbox"] as const;
  const sourceNames = {
    steam: "Steam",
    epic: "Epic Games",
    custom: t("orbit.local"),
    launchbox: "LaunchBox",
  };
  const heroImage =
    featured?.customHeroImageUrl || featured?.libraryHeroImageUrl;

  return (
    <section className="home__content">
      <header className="home__welcome">
        <div>
          <p className="home__date">
            {new Intl.DateTimeFormat(i18n.language, {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </p>
          <h1>
            {t("orbit.greeting", {
              name: userDetails?.displayName || t("orbit.player"),
            })}
          </h1>
        </div>
        <label className="home__search">
          <Search size={17} />
          <input
            aria-label={t("orbit.search")}
            placeholder={t("orbit.search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      <div className="home__top-grid">
        <section className="home__spotlight">
          {heroImage && (
            <img
              className="home__hero-art"
              src={heroImage}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="home__spotlight-content">
            <span className="home__pill">
              {t(featured ? "orbit.resume" : "orbit.welcome")}
            </span>
            <h2>{featured?.title || t("orbit.empty_title")}</h2>
            {featured ? (
              <>
                <div className="home__game-stats">
                  <div>
                    <strong>
                      {hours(getDisplayedPlayTimeInMilliseconds(featured))}
                    </strong>
                    <span>{t("orbit.playtime")}</span>
                  </div>
                  <div>
                    <strong>
                      {featured.unlockedAchievementCount ?? 0} /{" "}
                      {featured.achievementCount ?? 0}
                    </strong>
                    <span>{t("orbit.achievements")}</span>
                  </div>
                  <div>
                    <strong>{sourceNames[featured.shop]}</strong>
                    <span>{t("orbit.platform")}</span>
                  </div>
                </div>
                <div className="home__actions">
                  <button
                    className="home__primary"
                    onClick={() => open(featured)}
                  >
                    <Gamepad2 size={18} />
                    {t("orbit.open_game")}
                  </button>
                  <button
                    className="home__secondary"
                    onClick={() => navigate("/achievements")}
                  >
                    {t("orbit.view_achievements")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {t(hasLoaded ? "orbit.empty_description" : "orbit.loading")}
                </p>
                <button
                  className="home__primary"
                  onClick={() => navigate("/library")}
                >
                  {t("orbit.open_library")}
                  <ArrowRight size={18} />
                </button>
              </>
            )}
          </div>
        </section>
        <aside className="home__panel home__activity">
          <h3>{t("orbit.your_activity")}</h3>
          <strong className="home__big-number">{hours(totalTime)}</strong>
          <p>{t("orbit.total_playtime")}</p>
          <div className="home__activity-orbit">
            <Orbit size={96} strokeWidth={0.8} />
          </div>
          <div className="home__detail">
            <span>{t("orbit.last_played")}</span>
            <strong>{recent[0]?.title || "—"}</strong>
          </div>
          <div className="home__detail">
            <span>{t("orbit.achievements")}</span>
            <strong>
              {games.reduce(
                (sum, game) => sum + (game.unlockedAchievementCount ?? 0),
                0
              )}
            </strong>
          </div>
        </aside>
      </div>
      <section>
        <div className="home__section-heading">
          <h2>
            {t(
              query
                ? "orbit.results"
                : recent.length
                  ? "orbit.recent"
                  : "orbit.your_library"
            )}
          </h2>
          <button onClick={() => navigate("/library")}>
            {t("orbit.all_library")}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="home__recent-grid">
          {visible.map((game, index) => (
            <button
              className="home__recent-card"
              key={game.id}
              onClick={() => open(game)}
            >
              <div className={`home__cover home__cover--${index}`}>
                <span className="home__source">{sourceNames[game.shop]}</span>
                {(game.customCoverImageUrl ||
                  game.coverImageUrl ||
                  game.libraryImageUrl) && (
                  <img
                    src={
                      game.customCoverImageUrl ||
                      game.coverImageUrl ||
                      game.libraryImageUrl!
                    }
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div
                  className="home__cover-progress"
                  style={{
                    width: `${game.achievementCount ? Math.min(100, ((game.unlockedAchievementCount ?? 0) / game.achievementCount) * 100) : 0}%`,
                  }}
                />
              </div>
              <strong>{game.title}</strong>
              <span>{hours(getDisplayedPlayTimeInMilliseconds(game))}</span>
            </button>
          ))}
        </div>
        {!visible.length && (
          <div className="home__empty">
            {t(
              query
                ? "orbit.no_results"
                : hasLoaded
                  ? "orbit.no_recent"
                  : "orbit.loading"
            )}
          </div>
        )}
      </section>
      <div className="home__bottom-grid">
        <section className="home__panel">
          <div className="home__section-heading">
            <h3>{t("orbit.in_progress")}</h3>
            <span>{t("orbit.achievement_progress")}</span>
          </div>
          {progressing.map((game) => (
            <button
              className="home__achievement"
              key={game.id}
              onClick={() => open(game)}
            >
              <span className="home__trophy">
                <Trophy size={20} />
              </span>
              <div>
                <div className="home__achievement-label">
                  <strong>{game.title}</strong>
                  <span>
                    {game.unlockedAchievementCount} / {game.achievementCount}
                  </span>
                </div>
                <progress
                  aria-label={game.title}
                  value={game.unlockedAchievementCount ?? 0}
                  max={game.achievementCount}
                />
              </div>
            </button>
          ))}
          {!progressing.length && (
            <p className="home__empty">{t("orbit.no_progress")}</p>
          )}
        </section>
        <section className="home__panel">
          <h3>{t("orbit.your_library")}</h3>
          <div className="home__source-bar">
            {sources.map((source) => (
              <span
                key={source}
                className={`home__source-bar--${source}`}
                style={{
                  flex: games.filter((game) => game.shop === source).length,
                }}
                title={`${sourceNames[source]} · ${games.filter((game) => game.shop === source).length}`}
              />
            ))}
          </div>
          <div className="home__library-stats">
            <div>
              <strong>{games.length}</strong>
              <span>{t("orbit.total_games")}</span>
            </div>
            <div>
              <strong>{unplayed.length}</strong>
              <span>{t("orbit.never_played")}</span>
            </div>
            <div>
              <strong>{hours(totalTime)}</strong>
              <span>{t("orbit.playtime")}</span>
            </div>
            <div>
              <strong>{completed.length}</strong>
              <span>{t("orbit.completed")}</span>
            </div>
          </div>
          <button
            className="home__secondary home__random"
            disabled={!unplayed.length}
            onClick={() =>
              open(unplayed[Math.floor(Math.random() * unplayed.length)])
            }
          >
            {t("orbit.random")}
          </button>
        </section>
      </div>
    </section>
  );
}
