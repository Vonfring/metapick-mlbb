import Image from "next/image";
import Link from "next/link";
import type * as React from "react";
import { LOGO_PATHS } from "@/components/brand/logo-mark";
import { siteConfig } from "@/config/site";
import { formatPercent, initials } from "@/lib/format";
import type { LandingTier } from "@/lib/landing";
import type { Tier } from "@/types/domain";
import { LandingMotion } from "./landing-motion";
import "./landing.css";

export type LandingPageProps = {
  tiers: LandingTier[];
  cloud: { slug: string; name: string; tier: Tier }[];
  /** "Mythic, last 7 days, from the 14 Oct 2026 snapshot." Null before any data. */
  snapshotNote: string | null;
  /** "last 7 days" */
  periodText: string;
  /** "Epic to Mythic Glory" */
  rankRange: string;
  heroCount: number;
  rankCount: number;
  periodCount: number;
  toolCount: number;
};

const tierColor: Record<Tier, string> = {
  SS: "var(--t-ss)",
  S: "var(--t-s)",
  A: "var(--t-a)",
  B: "var(--t-b)",
  C: "var(--t-c)",
  D: "var(--t-d)",
};

/** Text on a tier color: dark on the light half of the ramp, light on the dark half (4.5:1 either way). */
const tierInk: Record<Tier, string> = {
  SS: "var(--bg)",
  S: "var(--bg)",
  A: "var(--bg)",
  B: "var(--bg)",
  C: "var(--fg)",
  D: "var(--fg)",
};

/** Horizontal starting points of the drifting hero tiles, spread so neighbours do not overlap. */
const cloudLanes = [
  4, 70, 18, 82, 9, 60, 30, 88, 2, 74, 22, 52, 66, 12, 80, 38, 6, 90, 26, 58,
  14, 72, 44, 84, 34, 64, 0, 78, 20, 56,
];

const tools = [
  {
    key: "draft",
    name: "Draft master",
    art: {
      src: "/art/tool-draft.webp",
      width: 575,
      height: 350,
      at: "42% 22%",
    },
    heading: "Practice the Mythic draft, turn by turn.",
    text: "Five bans a team in two blind waves, then picks in snake order. Every turn suggests a ban or a pick with its reasons, and both teams get a strength score out of 100.",
    cta: { href: "/draft", label: "Start a draft" },
    more: { href: "/about", label: "How it scores" },
  },
  {
    key: "counter",
    name: "Counter pick",
    art: {
      src: "/art/tool-counter.webp",
      width: 575,
      height: 350,
      at: "50% 18%",
    },
    heading: "Who beats Fanny and Ling?",
    text: "Add up to five enemies. Every hero is ranked by how many points of win rate it gains against that lineup, from ranked matchups, the official hero notes and each hero's strengths.",
    cta: { href: "/counter-pick?enemies=fanny,ling", label: "Try it" },
  },
  {
    key: "team",
    name: "Team composition",
    art: { src: "/art/tool-team.webp", width: 563, height: 350, at: "55% 35%" },
    heading: "See what your five are missing.",
    text: "Checks lanes, frontline, crowd control, peel and the damage mix, then suggests heroes that fill the gaps and swaps that raise the score.",
    cta: { href: "/team-composition", label: "Check a team" },
  },
  {
    key: "matchup",
    name: "Matchup",
    art: {
      src: "/art/tool-matchup.webp",
      width: 622,
      height: 350,
      at: "58% 20%",
    },
    heading: "Hero against hero, or five against five.",
    text: "A rule-based estimate from form, counters, synergy and composition, with every reason listed one by one.",
    cta: {
      href: "/matchup?hero=khufra&vs=fanny",
      label: "Compare Khufra and Fanny",
    },
  },
] as const;

/** Custom properties for inline styles. */
const vars = (values: Record<`--${string}`, string>) =>
  values as React.CSSProperties;

/**
 * Splits a heading into words that the motion script can raise one by one.
 * Screen readers get the sentence once, from the hidden copy.
 */
function Words({ text, wordClass }: { text: string; wordClass: "w" | "fw" }) {
  const words = text.split(/\s+/);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i}>
            {wordClass === "w" ? (
              <span className="w">
                <span>{word}</span>
              </span>
            ) : (
              <span className="fw">{word}</span>
            )}
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </>
  );
}

function Arrow() {
  return (
    <span className="arrow" aria-hidden="true">
      →
    </span>
  );
}

/**
 * The welcome page: one long scroll on a night-blue ground. A grainy mesh
 * hero with a halftone dot field in team colors, the four tools, a pinned
 * cloud of heroes, a stack of tier cards, and a closing panel that rises
 * over the page. Everything is static HTML; LandingMotion adds the motion.
 */
export function LandingPage(props: LandingPageProps) {
  const { tiers, cloud } = props;
  return (
    <div className="landing" id="landing">
      <header className="topbar">
        <div className="wrap">
          <a
            className="brand"
            href="#top"
            aria-label={`${siteConfig.name}, top of page`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
              <path d={LOGO_PATHS.enemy} fill="var(--enemy)" />
              <path d={LOGO_PATHS.ally} fill="var(--ally)" />
            </svg>
            {siteConfig.wordmark} <small>{siteConfig.label}</small>
          </a>
          <nav className="nav" aria-label="Page">
            <a className="text" href="#tools">
              Tools
            </a>
            <a className="text" href="#tiers">
              Tier list
            </a>
            <Link className="pill-link" href="/">
              Open the app
            </Link>
          </nav>
        </div>
      </header>

      <main id="top">
        <div className="sky">
          <div className="sky-bg" aria-hidden="true">
            <div className="mesh" />
            <canvas className="mesh-canvas" />
            <div className="grain-layer" />
          </div>

          <section
            className="hero"
            data-bg="#0a1017"
            aria-labelledby="hero-title"
          >
            <div className="hero-scrim" aria-hidden="true" />
            <div className="hero-art" aria-hidden="true">
              <div className="art-tilt">
                <div className="art-move">
                  <Image
                    src="/art/selena.webp"
                    width={1024}
                    height={576}
                    alt=""
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
              </div>
            </div>
            <canvas className="dots-canvas" aria-hidden="true" />
            <div className="wrap hero-content">
              <h1 id="hero-title">
                <span className="line">
                  <span>Know the counter</span>
                </span>{" "}
                <span className="line">
                  <span>before you play.</span>
                </span>
              </h1>
              <p className="lede">
                Counter picks, matchups, team checks and a ranked draft
                simulator for Mobile Legends. Every suggestion shows the numbers
                behind it.
              </p>
              <div className="ctas">
                <Link className="btn btn-light magnetic" href="/draft">
                  <span>Practice a draft</span>
                  <Arrow />
                </Link>
                <Link className="btn btn-glass magnetic" href="/counter-pick">
                  <span>Find counters</span>
                </Link>
              </div>
            </div>
          </section>

          <section
            className="tools"
            id="tools"
            data-bg="#0a1017"
            aria-labelledby="tools-title"
          >
            <div className="tools-bg" aria-hidden="true" />
            <div className="wrap">
              <div className="head">
                <span className="eyebrow">Four tools for the draft</span>
                <h2 id="tools-title" className="split-words">
                  <Words
                    text="From the first ban to the last pick."
                    wordClass="w"
                  />
                </h2>
                <p>Each tool works on its own and links to the next.</p>
              </div>
              <div className="tool-grid">
                {tools.map((tool) => (
                  <article
                    key={tool.key}
                    className="tool"
                    style={vars({ "--art-pos": tool.art.at })}
                    aria-labelledby={`${tool.key}-title`}
                  >
                    <div className="tool-preview" aria-hidden="true">
                      <Image
                        className="tool-art"
                        src={tool.art.src}
                        width={tool.art.width}
                        height={tool.art.height}
                        alt=""
                        loading="lazy"
                      />
                      <p className="tool-title">{tool.name}</p>
                    </div>
                    <div className="tool-info">
                      <span className="tool-kicker">{tool.name}</span>
                      <h3 id={`${tool.key}-title`}>{tool.heading}</h3>
                      <p>{tool.text}</p>
                      <div className="ctas">
                        <Link
                          className="btn btn-light btn-sm"
                          href={tool.cta.href}
                        >
                          <span>{tool.cta.label}</span>
                          <Arrow />
                        </Link>
                        {"more" in tool ? (
                          <Link className="text-link" href={tool.more.href}>
                            {tool.more.label}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section
          className="cloud"
          data-bg="#120d22"
          aria-labelledby="cloud-title"
        >
          <div className="cloud-tiles" aria-hidden="true">
            {cloud.map((hero, i) => (
              <span
                key={hero.slug}
                className="tile"
                data-depth={(0.55 + (((i * 37) % 10) / 10) * 0.8).toFixed(2)}
                style={vars({
                  "--x": `${cloudLanes[i % cloudLanes.length]}%`,
                  "--tc": tierColor[hero.tier],
                  "--tf": tierInk[hero.tier],
                })}
              >
                <span className="avatar">{initials(hero.name)}</span>
                {hero.name} <span className="tier">{hero.tier}</span>
              </span>
            ))}
          </div>
          <div className="wrap cloud-text">
            <span className="eyebrow">Updated every day</span>
            <h2 id="cloud-title">Every hero. Every rank.</h2>
            <p className="fill">
              <Words
                text={`Win, pick and ban rates for the whole roster, from ${props.rankRange}, refreshed daily from ranked games.`}
                wordClass="fw"
              />
            </p>
          </div>
        </section>

        <section
          className="tiers"
          id="tiers"
          data-bg="#170d09"
          aria-labelledby="tiers-title"
        >
          <div className="wrap tiers-grid">
            <div className="head">
              <span className="eyebrow">Tier list</span>
              <h2 id="tiers-title" className="split-words">
                <Words text="From SS to D in one scroll." wordClass="w" />
              </h2>
              <p>
                {props.snapshotNote
                  ? `${props.snapshotNote} Tiers come from adjusted win rate, ban rate and pick rate compared with every other hero.`
                  : "Tiers appear here once the first ranked statistics are in."}
              </p>
            </div>
            {tiers.length > 0 ? (
              <div className="stack">
                {tiers.map(({ tier, count, heroes }) => (
                  <article
                    key={tier}
                    className="tier-card"
                    style={vars({ "--tc": tierColor[tier] })}
                    aria-label={`Tier ${tier}, ${count} heroes`}
                  >
                    <div className="tier-card-top">
                      <span className="tier-letter">{tier}</span>
                      <span className="tier-count">{count} heroes</span>
                    </div>
                    <ul className="tier-heroes">
                      {heroes.map((hero) => (
                        <li key={hero.slug}>
                          <span>{hero.name}</span>
                          <b>{formatPercent(hero.winRate)}</b>
                        </li>
                      ))}
                    </ul>
                    <p className="tier-note">
                      {count > heroes.length
                        ? `and ${count - heroes.length} more`
                        : `Win rates in the ${props.periodText}`}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section
          className="data"
          data-bg="#0a1017"
          aria-labelledby="data-title"
        >
          <div className="wrap split data-inner">
            <div className="head">
              <span className="eyebrow">The data</span>
              <h2 id="data-title" className="split-words">
                <Words text="Where the numbers come from." wordClass="w" />
              </h2>
            </div>
            <dl className="data-list">
              <div>
                <dt>Ranked statistics</dt>
                <dd>
                  Win, pick and ban rates for {props.rankCount} ranks and{" "}
                  {props.periodCount} periods, from the data behind the official
                  Mobile Legends website. Refreshed every day.
                </dd>
              </div>
              <div>
                <dt>Heroes and skills</dt>
                <dd>
                  Roles, lanes, skills and the official hero notes, checked
                  every week.
                </dd>
              </div>
              <div>
                <dt>Items and emblems</dt>
                <dd>
                  From the{" "}
                  <a href={siteConfig.catalogCredit.source.href}>
                    {siteConfig.catalogCredit.source.label}
                  </a>{" "}
                  Mobile Legends wiki, under{" "}
                  <a href={siteConfig.catalogCredit.license.href}>
                    {siteConfig.catalogCredit.license.label}
                  </a>
                  .
                </dd>
              </div>
              <div>
                <dt>Team tags</dt>
                <dd>
                  Frontline, crowd control, peel and more, curated by hand for
                  every hero.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rise" aria-labelledby="closing-title">
          <div className="grain-layer" aria-hidden="true" />
          <div className="wrap rise-inner">
            <h2 id="closing-title" className="split-words">
              <Words
                text="Open it before your next ranked game."
                wordClass="w"
              />
            </h2>
            <p className="lede">
              Free, no account, and it works on your phone while the draft timer
              runs.
            </p>
            <div className="ctas">
              <Link className="btn btn-light magnetic" href="/draft">
                <span>Practice a draft</span>
                <Arrow />
              </Link>
              <Link className="btn btn-glass magnetic" href="/tier-list">
                <span>See the tier list</span>
              </Link>
            </div>
            <div className="stats">
              <div className="stat">
                <b data-value={props.heroCount}>{props.heroCount}</b>
                <span>Heroes with ranked statistics</span>
              </div>
              <div className="stat">
                <b data-value={props.rankCount * props.periodCount}>
                  {props.rankCount * props.periodCount}
                </b>
                <span>Rank and period views, refreshed daily</span>
              </div>
              <div className="stat">
                <b data-value={props.toolCount}>{props.toolCount}</b>
                <span>Tools for every turn of the draft</span>
              </div>
            </div>
          </div>
          <footer>
            <div className="wrap">
              <p>
                <strong>{siteConfig.disclaimer}</strong>{" "}
                {siteConfig.attribution}
              </p>
              <Link href="/about">About the data</Link>
            </div>
          </footer>
        </section>
      </main>
      <LandingMotion />
    </div>
  );
}
