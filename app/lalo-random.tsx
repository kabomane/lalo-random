"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Compass,
  Crosshair,
  Dice5,
  Globe2,
  MapPin,
  RotateCcw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COUNTRIES_BY_CODE,
  GEO,
  formatCoordinate,
  randomLandAwareWorldPoint,
  randomPointInCountries,
  randomPointOutsideCountries,
} from "@/lib/coordinate-engine";

type Mode = "world" | "include" | "exclude";
type Distribution = "equal" | "area";
type PanelView = "draw" | "settings";
type Settings = {
  distribution: Distribution;
  avoidOcean: boolean;
};
type CoordinateResult = {
  lat: number;
  lon: number;
  country: { code: string; name: string } | null;
};
type GeoCountry = (typeof GEO)[number];

const countryIndex = COUNTRIES_BY_CODE as Record<string, GeoCountry | undefined>;
const SETTINGS_KEY = "lalo-random:settings";

const modeLabels: Record<Mode, string> = {
  world: "Monde",
  include: "Inclusion",
  exclude: "Exclusion",
};

const frenchRegionNames = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

function countryLabel(country: Pick<GeoCountry, "code" | "name">) {
  const translated = frenchRegionNames?.of(country.code);
  return translated && translated !== country.code ? translated : country.name;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

function countryRelevance(country: GeoCountry, query: string) {
  const code = country.code.toLowerCase();
  const frenchName = normalizeSearch(countryLabel(country));
  const originalName = normalizeSearch(country.name);

  if (code === query) return 0;
  if (frenchName === query || originalName === query) return 1;
  if (code.startsWith(query)) return 2;
  if (frenchName.startsWith(query) || originalName.startsWith(query)) return 3;
  if (frenchName.split(/\s+/).some((word) => word.startsWith(query))) return 4;
  if (originalName.split(/\s+/).some((word) => word.startsWith(query))) return 5;
  if (frenchName.includes(query) || originalName.includes(query)) return 6;
  return null;
}

function readSettings(): Settings {
  const defaults: Settings = { distribution: "equal", avoidOcean: false };
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Partial<Settings>;
    return {
      distribution: parsed.distribution === "area" ? "area" : "equal",
      avoidOcean: parsed.avoidOcean === true,
    };
  } catch {
    return defaults;
  }
}

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 500;

function project(lon: number, lat: number) {
  return {
    x: ((lon + 180) / 360) * VIEW_WIDTH,
    y: ((90 - lat) / 180) * VIEW_HEIGHT,
  };
}

function ringToPath(ring: number[][]) {
  return ring
    .map(([lon, lat], index) => {
      const point = project(lon, lat);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function WorldMap({
  selectedCodes,
  mode,
  result,
}: {
  selectedCodes: string[];
  mode: Mode;
  result: CoordinateResult | null;
}) {
  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const point = result ? project(result.lon, result.lat) : null;

  return (
    <div className="atlas" aria-label="Carte du monde affichant les pays sélectionnés et les coordonnées tirées">
      <svg className="atlas-grid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img">
        <defs>
          <pattern id="grid" width="83.333" height="83.333" patternUnits="userSpaceOnUse">
            <path d="M 83.333 0 L 0 0 0 83.333" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <filter id="point-glow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#grid)" className="atlas-graticule" />
        <g className="atlas-countries">
          {GEO.flatMap((country) =>
            country.rings.map((ring, ringIndex) => {
              const selected = selectedSet.has(country.code);
              return (
                <path
                  key={`${country.code}-${ringIndex}`}
                  d={ringToPath(ring.points)}
                  className={selected ? `country selected ${mode}` : "country"}
                >
                  <title>{countryLabel(country)}</title>
                </path>
              );
            }),
          )}
        </g>
        {point && (
          <g className="map-point" transform={`translate(${point.x} ${point.y})`} filter="url(#point-glow)">
            <circle r="15" className="map-point-ring" />
            <circle r="5" className="map-point-core" />
          </g>
        )}
      </svg>
      <div className="atlas-corner atlas-corner-top">
        <span>90°N</span>
        <span>180°E</span>
      </div>
      <div className="atlas-corner atlas-corner-bottom">
        <span>90°S</span>
        <span>180°W</span>
      </div>
      {!result && (
        <div className="atlas-empty">
          <Crosshair aria-hidden="true" />
          <span>Votre prochain point apparaîtra ici</span>
        </div>
      )}
    </div>
  );
}

function CountryPicker({
  selectedCodes,
  onToggle,
  onClear,
  mode,
}: {
  selectedCodes: string[];
  onToggle: (code: string) => void;
  onClear: () => void;
  mode: Mode;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const selectedCountries = useMemo(
    () => selectedCodes
      .map((code) => countryIndex[code])
      .filter((country): country is GeoCountry => Boolean(country)),
    [selectedCodes],
  );
  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return [];

    return GEO
      .map((country) => ({ country, score: countryRelevance(country, normalizedQuery) }))
      .filter((result): result is { country: GeoCountry; score: number } => result.score !== null)
      .sort((a, b) => a.score - b.score || countryLabel(a.country).localeCompare(countryLabel(b.country), "fr"))
      .slice(0, 3)
      .map(({ country }) => country);
  }, [query]);

  return (
    <section className="control-section country-section" aria-labelledby="country-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">02 / Territoire</span>
          <h2 id="country-title">{mode === "include" ? "Pays à inclure" : "Pays à exclure"}</h2>
        </div>
        <span className="selection-count">{selectedCodes.length}</span>
      </div>

      {selectedCountries.length > 0 && (
        <div className="selected-strip" aria-label="Pays sélectionnés">
          {selectedCountries.map((country) => (
            <button key={country.code} type="button" onClick={() => onToggle(country.code)}>
              <span>{country.code}</span>
              <X aria-hidden="true" />
              <span className="sr-only">Retirer {countryLabel(country)}</span>
            </button>
          ))}
          <button type="button" className="clear-selection" onClick={onClear}>
            Tout retirer
          </button>
        </div>
      )}

      <Command className="country-command" shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher un pays ou un code ISO"
          aria-label="Rechercher des pays"
        />
        {query.trim() && (
          <CommandList>
            {searchResults.length === 0 && <CommandEmpty>Aucun pays trouvé.</CommandEmpty>}
            {searchResults.map((country) => {
              const active = selectedSet.has(country.code);
              return (
                <CommandItem
                  key={country.code}
                  value={country.code}
                  onSelect={() => {
                    onToggle(country.code);
                    setQuery("");
                  }}
                  className="country-option"
                >
                  <span className="country-code">{country.code}</span>
                  <span>{countryLabel(country)}</span>
                  {active && <Check className="country-check" aria-hidden="true" />}
                </CommandItem>
              );
            })}
          </CommandList>
        )}
      </Command>
    </section>
  );
}

function CoordinateReadout({
  result,
  onCopy,
}: {
  result: CoordinateResult | null;
  onCopy: () => void;
}) {
  return (
    <section className="readout" aria-live="polite">
      <div className="readout-values">
        <div className="readout-location">
          <span className="readout-icon"><MapPin aria-hidden="true" /></span>
          <div>
            <span className="readout-label">Lieu</span>
            <strong>
              {result?.country
                ? countryLabel(result.country)
                : result
                  ? "Océan"
                  : "Aucun tirage"}
            </strong>
          </div>
        </div>
        <div>
          <span>Latitude</span>
          <strong>{result ? formatCoordinate(result.lat) : "—"}</strong>
        </div>
        <div>
          <span>Longitude</span>
          <strong>{result ? formatCoordinate(result.lon) : "—"}</strong>
        </div>
      </div>
      <Button className="copy-button" variant="outline" onClick={onCopy} disabled={!result}>
        <Clipboard aria-hidden="true" />
        Copier les coordonnées
      </Button>
    </section>
  );
}

function SettingsView({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  return (
    <div className="settings-view">
      <section className="control-section" aria-labelledby="ocean-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">01 / Surface</span>
            <h2 id="ocean-title">Présence de l’océan</h2>
          </div>
        </div>
        <label className="switch-row">
          <span>
            <strong>Terres uniquement</strong>
            <small>Relance automatiquement le tirage lorsqu’un point tombe dans l’océan.</small>
          </span>
          <Switch
            checked={settings.avoidOcean}
            onCheckedChange={(avoidOcean) => onChange({ ...settings, avoidOcean })}
            aria-label="Générer uniquement des coordonnées terrestres"
          />
        </label>
      </section>

      <section className="control-section" aria-labelledby="distribution-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">02 / Répartition</span>
            <h2 id="distribution-title">Probabilité par pays</h2>
          </div>
        </div>
        <RadioGroup
          value={settings.distribution}
          onValueChange={(distribution) => onChange({ ...settings, distribution: distribution as Distribution })}
          className="distribution-options"
        >
          <label className={settings.distribution === "equal" ? "distribution-card active" : "distribution-card"}>
            <RadioGroupItem value="equal" />
            <span>
              <strong>Chance égale</strong>
              <small>Chaque pays sélectionné a la même probabilité d’être tiré.</small>
            </span>
          </label>
          <label className={settings.distribution === "area" ? "distribution-card active" : "distribution-card"}>
            <RadioGroupItem value="area" />
            <span>
              <strong>Pondération par superficie</strong>
              <small>Les grands pays sont tirés plus souvent que les petits.</small>
            </span>
          </label>
        </RadioGroup>
      </section>

      <p className="settings-note">Les paramètres sont enregistrés automatiquement sur cet appareil.</p>
    </div>
  );
}

export default function LaloRandom() {
  const [panelView, setPanelView] = useState<PanelView>("draw");
  const [mode, setMode] = useState<Mode>("world");
  const [includeCodes, setIncludeCodes] = useState<string[]>([]);
  const [excludeCodes, setExcludeCodes] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [result, setResult] = useState<CoordinateResult | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // The generator remains usable when browser storage is unavailable.
    }
  }, [settings]);

  const codes = mode === "include" ? includeCodes : excludeCodes;
  const selectedCountries = useMemo(
    () => codes
      .map((code) => countryIndex[code])
      .filter((country): country is GeoCountry => Boolean(country)),
    [codes],
  );
  const blocked = mode === "include" && selectedCountries.length === 0;

  const toggleCode = useCallback((code: string) => {
    const setter = mode === "include" ? setIncludeCodes : setExcludeCodes;
    setter((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }, [mode]);

  const clearCodes = useCallback(() => {
    if (mode === "include") setIncludeCodes([]);
    else setExcludeCodes([]);
  }, [mode]);

  const randomize = useCallback(() => {
    let next: CoordinateResult | null = null;
    if (mode === "include") {
      next = randomPointInCountries(selectedCountries, settings.distribution);
    } else if (mode === "exclude") {
      next = randomPointOutsideCountries(selectedCountries, settings.avoidOcean);
    } else {
      next = randomLandAwareWorldPoint(settings.avoidOcean);
    }
    if (next && Number.isFinite(next.lat) && Number.isFinite(next.lon)) setResult(next);
  }, [mode, selectedCountries, settings]);

  const copyCoordinates = useCallback(async () => {
    if (!result) return;
    const value = `${formatCoordinate(result.lat)}, ${formatCoordinate(result.lon)}`;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Coordonnées copiées");
    } catch {
      toast.error("Copie indisponible");
    }
  }, [result]);

  const reset = useCallback(() => {
    setMode("world");
    setIncludeCodes([]);
    setExcludeCodes([]);
    setResult(null);
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Accueil de Lalo Random">
          <span className="brand-mark"><Compass aria-hidden="true" /></span>
          <span>LALO<span>/</span>RANDOM</span>
        </a>
        <div className="topbar-meta">
          <span><span className="status-dot" /> Moteur local</span>
          <span>{GEO.length} territoires</span>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Réinitialiser
          </Button>
        </div>
      </header>

      <div className="workspace" id="top">
        <section className="map-panel">
          <div className="map-toolbar">
            <span>Carte du tirage</span>
            <span className="mode-badge"><Globe2 aria-hidden="true" /> {modeLabels[mode]}</span>
          </div>
          <WorldMap selectedCodes={codes} mode={mode} result={result} />
          <CoordinateReadout result={result} onCopy={copyCoordinates} />
        </section>

        <aside className="control-panel">
          <nav className="panel-navigation" aria-label="Navigation du panneau">
            <button
              type="button"
              className={panelView === "draw" ? "active" : ""}
              onClick={() => setPanelView("draw")}
            >
              <Dice5 aria-hidden="true" /> Tirage
            </button>
            <button
              type="button"
              className={panelView === "settings" ? "active" : ""}
              onClick={() => setPanelView("settings")}
            >
              <Settings2 aria-hidden="true" /> Paramètres
            </button>
          </nav>

          {panelView === "draw" ? (
            <>
              <section className="control-section mode-section" aria-labelledby="mode-title">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">01 / Mode</span>
                    <h2 id="mode-title">Zone du tirage</h2>
                  </div>
                </div>
                <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
                  <TabsList className="mode-tabs">
                    <TabsTrigger value="world">Monde</TabsTrigger>
                    <TabsTrigger value="include">Inclure</TabsTrigger>
                    <TabsTrigger value="exclude">Exclure</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="mode-description">
                  {mode === "world" && "Tirage sur l’ensemble du globe."}
                  {mode === "include" && "Le point restera dans l’un des pays sélectionnés."}
                  {mode === "exclude" && "Le point évitera tous les pays sélectionnés."}
                </p>
              </section>

              {mode !== "world" && (
                <CountryPicker selectedCodes={codes} onToggle={toggleCode} onClear={clearCodes} mode={mode} />
              )}

              <div className="draw-zone">
                {blocked && <p className="draw-warning"><Search aria-hidden="true" /> Sélectionnez au moins un pays.</p>}
                <Button className="draw-button" size="lg" onClick={randomize} disabled={blocked}>
                  <Dice5 aria-hidden="true" /> Tirer des coordonnées
                </Button>
                <p>Sans compte ni suivi : le tirage s’effectue sur votre appareil.</p>
              </div>
            </>
          ) : (
            <SettingsView settings={settings} onChange={setSettings} />
          )}
        </aside>
      </div>
    </main>
  );
}
