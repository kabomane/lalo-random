"use client";

import { useCallback, useMemo, useState } from "react";
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
type CoordinateResult = {
  lat: number;
  lon: number;
  country: { code: string; name: string } | null;
};
type GeoCountry = (typeof GEO)[number];

const countryIndex = COUNTRIES_BY_CODE as Record<string, GeoCountry | undefined>;

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
    <div className="atlas" aria-label="World map showing selected countries and generated coordinate">
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
                  <title>{country.name}</title>
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
          <span>Your next coordinate will appear here</span>
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
  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const selectedCountries = useMemo(
    () => selectedCodes
      .map((code) => countryIndex[code])
      .filter((country): country is GeoCountry => Boolean(country)),
    [selectedCodes],
  );

  return (
    <section className="control-section country-section" aria-labelledby="country-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">02 / Territory</span>
          <h2 id="country-title">{mode === "include" ? "Countries in play" : "Countries off limits"}</h2>
        </div>
        <span className="selection-count">{selectedCodes.length}</span>
      </div>

      {selectedCountries.length > 0 && (
        <div className="selected-strip" aria-label="Selected countries">
          {selectedCountries.map((country) => (
            <button key={country.code} type="button" onClick={() => onToggle(country.code)}>
              <span>{country.code}</span>
              <X aria-hidden="true" />
              <span className="sr-only">Remove {country.name}</span>
            </button>
          ))}
          <button type="button" className="clear-selection" onClick={onClear}>
            Clear
          </button>
        </div>
      )}

      <Command className="country-command">
        <CommandInput placeholder="Search a country or ISO code" aria-label="Search countries" />
        <CommandList>
          <CommandEmpty>No country matches your search.</CommandEmpty>
          {GEO.map((country) => {
            const active = selectedSet.has(country.code);
            return (
              <CommandItem
                key={country.code}
                value={`${country.name} ${country.code}`}
                onSelect={() => onToggle(country.code)}
                className="country-option"
              >
                <span className="country-code">{country.code}</span>
                <span>{country.name}</span>
                {active && <Check className="country-check" aria-hidden="true" />}
              </CommandItem>
            );
          })}
        </CommandList>
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
      <div className="readout-location">
        <span className="readout-icon"><MapPin aria-hidden="true" /></span>
        <div>
          <span className="readout-label">Location</span>
          <strong>{result?.country?.name ?? (result ? "Open ocean" : "Awaiting draw")}</strong>
        </div>
      </div>
      <div className="coordinate-pair">
        <div>
          <span>Latitude</span>
          <strong>{result ? formatCoordinate(result.lat) : "—"}</strong>
        </div>
        <div>
          <span>Longitude</span>
          <strong>{result ? formatCoordinate(result.lon) : "—"}</strong>
        </div>
      </div>
      <Button className="copy-button" variant="outline" size="icon-lg" onClick={onCopy} disabled={!result}>
        <Clipboard aria-hidden="true" />
        <span className="sr-only">Copy coordinates</span>
      </Button>
    </section>
  );
}

export default function LaloRandom() {
  const [mode, setMode] = useState<Mode>("world");
  const [includeCodes, setIncludeCodes] = useState<string[]>([]);
  const [excludeCodes, setExcludeCodes] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<Distribution>("equal");
  const [avoidOcean, setAvoidOcean] = useState(false);
  const [result, setResult] = useState<CoordinateResult | null>(null);

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
      next = randomPointInCountries(selectedCountries, distribution);
    } else if (mode === "exclude") {
      next = randomPointOutsideCountries(selectedCountries, avoidOcean);
    } else {
      next = randomLandAwareWorldPoint(avoidOcean);
    }
    if (next && Number.isFinite(next.lat) && Number.isFinite(next.lon)) setResult(next);
  }, [avoidOcean, distribution, mode, selectedCountries]);

  const copyCoordinates = useCallback(async () => {
    if (!result) return;
    const value = `${formatCoordinate(result.lat)}, ${formatCoordinate(result.lon)}`;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Coordinates copied");
    } catch {
      toast.error("Copy unavailable");
    }
  }, [result]);

  const reset = useCallback(() => {
    setMode("world");
    setIncludeCodes([]);
    setExcludeCodes([]);
    setDistribution("equal");
    setAvoidOcean(false);
    setResult(null);
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lalo Random home">
          <span className="brand-mark"><Compass aria-hidden="true" /></span>
          <span>LALO<span>/</span>RANDOM</span>
        </a>
        <div className="topbar-meta">
          <span><span className="status-dot" /> Offline engine</span>
          <span>{GEO.length} territories</span>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
        </div>
      </header>

      <div className="workspace" id="top">
        <section className="map-panel">
          <div className="map-heading">
            <div>
              <p>Coordinate generator</p>
              <h1>Leave it to chance.</h1>
            </div>
            <span className="mode-badge"><Globe2 aria-hidden="true" /> {mode}</span>
          </div>
          <WorldMap selectedCodes={codes} mode={mode} result={result} />
          <CoordinateReadout result={result} onCopy={copyCoordinates} />
        </section>

        <aside className="control-panel">
          <section className="control-section mode-section" aria-labelledby="mode-title">
            <div className="section-heading">
              <div>
                <span className="section-kicker">01 / Method</span>
                <h2 id="mode-title">Choose the rules</h2>
              </div>
            </div>
            <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
              <TabsList className="mode-tabs">
                <TabsTrigger value="world">World</TabsTrigger>
                <TabsTrigger value="include">Include</TabsTrigger>
                <TabsTrigger value="exclude">Exclude</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="mode-description">
              {mode === "world" && "Draw from the entire planet, with or without ocean."}
              {mode === "include" && "Every result stays inside one of your selected countries."}
              {mode === "exclude" && "Draw anywhere except inside the countries you block."}
            </p>
          </section>

          {mode !== "world" && (
            <CountryPicker selectedCodes={codes} onToggle={toggleCode} onClear={clearCodes} mode={mode} />
          )}

          <section className="control-section behavior-section" aria-labelledby="behavior-title">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">{mode === "world" ? "02" : "03"} / Behavior</span>
                <h2 id="behavior-title">Tune the draw</h2>
              </div>
            </div>

            {mode === "include" ? (
              <RadioGroup value={distribution} onValueChange={(value) => setDistribution(value as Distribution)} className="distribution-options">
                <label className={distribution === "equal" ? "distribution-card active" : "distribution-card"}>
                  <RadioGroupItem value="equal" />
                  <span><strong>Equal chance</strong><small>Each selected country has the same odds.</small></span>
                </label>
                <label className={distribution === "area" ? "distribution-card active" : "distribution-card"}>
                  <RadioGroupItem value="area" />
                  <span><strong>Land weighted</strong><small>Larger countries are drawn more often.</small></span>
                </label>
              </RadioGroup>
            ) : (
              <label className="switch-row">
                <span>
                  <strong>Land only</strong>
                  <small>Automatically reroll ocean coordinates.</small>
                </span>
                <Switch checked={avoidOcean} onCheckedChange={setAvoidOcean} aria-label="Generate land coordinates only" />
              </label>
            )}
          </section>

          <div className="draw-zone">
            {blocked && <p className="draw-warning"><Search aria-hidden="true" /> Select at least one country first.</p>}
            <Button className="draw-button" size="lg" onClick={randomize} disabled={blocked}>
              <Dice5 aria-hidden="true" /> Draw a coordinate
            </Button>
            <p>No account. No tracking. The draw runs on your device.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
