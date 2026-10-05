"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  AmbientLight,
  DirectionalLight,
  FlyToInterpolator,
  LightingEffect,
  LinearInterpolator,
  type MapViewState,
  type PickingInfo,
} from "@deck.gl/core";
import { PathLayer, PolygonLayer } from "@deck.gl/layers";
import DeckGL, { type DeckGLRef } from "@deck.gl/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as BaseMap } from "react-map-gl/maplibre";
import type { CityData, LngLat } from "@/core/city/types";
import { CITY_PRESETS, DEFAULT_CITY_ID } from "@/data/cityPresets";
import { useCityStore, type CameraTarget } from "@/stores/useCityStore";
import { CityInspectionPanel } from "./CityInspectionPanel";
import { CitySearchBar } from "./CitySearchBar";
import { ViewportControls } from "./ViewportControls";

/** Free, keyless vector basemap (OpenMapTiles schema, OSM data). */
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
const PITCH_3D = 50;

type RGBA = [number, number, number, number];
// Tailwind slate / blue / amber, as RGBA.
const BUILDING_FILL: RGBA = [51, 65, 85, 255]; // slate-700 (lighting darkens it toward slate-800)
const BUILDING_EDGE: RGBA = [100, 116, 139, 255]; // slate-500
const BUILDING_SELECTED: RGBA = [59, 130, 246, 255]; // blue-500
const BUILDING_HOVER: RGBA = [96, 165, 250, 200]; // blue-400
const ROAD: RGBA = [71, 85, 105, 255]; // slate-600
const ROAD_TUNNEL: RGBA = [71, 85, 105, 90];
const ROAD_SELECTED: RGBA = [251, 191, 36, 255]; // amber-400
const ROAD_HOVER: RGBA = [245, 158, 11, 230]; // amber-500

/** One renderable footprint; multi-outer buildings have several. */
interface BuildingPart {
  entityId: string;
  name: string;
  /** Rings with z = base height, so `min_height` slabs float. */
  polygon: [number, number, number][][];
  elevation: number;
}

/** One continuous run of a (possibly clipped) road. */
interface RoadPart {
  entityId: string;
  name: string;
  path: LngLat[];
  width: number;
  tunnel: boolean;
}

function buildParts(cities: readonly CityData[]) {
  const buildings: BuildingPart[] = [];
  const roads: RoadPart[] = [];
  const seen = new Set<string>();
  for (const city of cities) {
    for (const b of city.buildings) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      for (const polygon of b.polygons) {
        buildings.push({
          entityId: b.id,
          name: b.name,
          polygon: polygon.map((ring) =>
            ring.map(
              ([x, y]) => [x, y, b.minHeight] as [number, number, number],
            ),
          ),
          elevation: b.height - b.minHeight,
        });
      }
    }
    for (const r of city.roads) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const tunnel = r.properties.tunnel === true;
      for (const path of r.paths)
        roads.push({
          entityId: r.id,
          name: r.name,
          path,
          width: r.width,
          tunnel,
        });
    }
  }
  return { buildings, roads };
}

const lighting = new LightingEffect({
  ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.1 }),
  sun: new DirectionalLight({
    color: [255, 244, 229],
    intensity: 1.6,
    direction: [-3, -6, -2],
  }),
});
const EFFECTS = [lighting];
const MATERIAL = {
  ambient: 0.45,
  diffuse: 0.6,
  shininess: 24,
  specularColor: [60, 64, 72] as [number, number, number],
};

function viewFromTarget(target: CameraTarget | null): MapViewState {
  const preset = CITY_PRESETS.find((p) => p.id === DEFAULT_CITY_ID)!;
  const center = target?.center ?? preset.center;
  return {
    longitude: center[0],
    latitude: center[1],
    zoom: target?.zoom ?? preset.zoom,
    pitch: target?.pitch ?? PITCH_3D,
    bearing: target?.bearing ?? preset.bearing,
    maxPitch: 75,
  };
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

const cursor = ({
  isDragging,
  isHovering,
}: {
  isDragging: boolean;
  isHovering: boolean;
}) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab");

const tooltip = ({ object, layer }: PickingInfo<BuildingPart | RoadPart>) =>
  object
    ? {
        text: `${object.name}\n${layer?.id === "buildings" ? "Building" : "Road"} · ${object.entityId}`,
        style: {
          background: "rgba(2, 6, 23, 0.85)",
          color: "#e2e8f0",
          fontSize: "12px",
          borderRadius: "6px",
          border: "1px solid #1e293b",
          padding: "6px 8px",
        },
      }
    : null;

/** Deck.gl city scene + MapLibre underlay + floating controls. */
export function CityViewer() {
  const order = useCityStore((s) => s.order);
  const cityMap = useCityStore((s) => s.cities);
  const selectedId = useCityStore((s) => s.selectedId);
  const camera = useCityStore((s) => s.camera);
  const select = useCityStore((s) => s.select);

  const [viewState, setViewState] = useState<MapViewState>(() =>
    viewFromTarget(useCityStore.getState().camera),
  );
  // Remounts (route round trip) start at the last target without re-flying.
  const appliedNonce = useRef(useCityStore.getState().camera?.nonce ?? 0);
  const deckRef = useRef<DeckGLRef>(null);

  // Dev-only handle for inspecting picking/rendering from the console.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __cityDeck?: () => unknown };
    w.__cityDeck = () => deckRef.current?.deck;
    return () => {
      delete w.__cityDeck;
    };
  }, []);

  useEffect(() => {
    if (!camera || camera.nonce === appliedNonce.current) return;
    appliedNonce.current = camera.nonce;
    setViewState((vs) => ({
      ...vs,
      longitude: camera.center[0],
      latitude: camera.center[1],
      zoom: camera.zoom ?? vs.zoom,
      bearing: camera.bearing ?? vs.bearing,
      pitch: camera.pitch ?? vs.pitch,
      transitionDuration: "auto",
      transitionInterpolator: new FlyToInterpolator({
        speed: 1.8,
        maxDuration: 4000,
      }),
    }));
  }, [camera]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isTyping(e.target)) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const cities = useMemo(
    () => order.map((id) => cityMap[id]),
    [order, cityMap],
  );
  const parts = useMemo(() => buildParts(cities), [cities]);

  const layers = useMemo(
    () => [
      new PathLayer<RoadPart>({
        id: "roads",
        data: parts.roads,
        getPath: (d) => d.path,
        getWidth: (d) => d.width,
        widthUnits: "meters",
        widthMinPixels: 1.5,
        capRounded: true,
        jointRounded: true,
        getColor: (d) =>
          d.entityId === selectedId
            ? ROAD_SELECTED
            : d.tunnel
              ? ROAD_TUNNEL
              : ROAD,
        updateTriggers: { getColor: [selectedId] },
        pickable: true,
        autoHighlight: true,
        highlightColor: ROAD_HOVER,
      }),
      new PolygonLayer<BuildingPart>({
        id: "buildings",
        data: parts.buildings,
        getPolygon: (d) => d.polygon,
        extruded: true,
        wireframe: true,
        getElevation: (d) => d.elevation,
        getFillColor: (d) =>
          d.entityId === selectedId ? BUILDING_SELECTED : BUILDING_FILL,
        getLineColor: BUILDING_EDGE,
        updateTriggers: { getFillColor: [selectedId] },
        material: MATERIAL,
        pickable: true,
        autoHighlight: true,
        highlightColor: BUILDING_HOVER,
      }),
    ],
    [parts, selectedId],
  );

  const onClick = useCallback(
    (info: PickingInfo<BuildingPart | RoadPart>) =>
      select(info.object?.entityId ?? null),
    [select],
  );

  const ease = useCallback(
    (patch: Partial<MapViewState>) =>
      setViewState((vs) => ({
        ...vs,
        ...patch,
        transitionDuration: 300,
        transitionInterpolator: new LinearInterpolator([
          "zoom",
          "pitch",
          "bearing",
        ]),
      })),
    [],
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <DeckGL
        ref={deckRef}
        viewState={viewState}
        onViewStateChange={({ viewState: next }) =>
          setViewState(next as MapViewState)
        }
        controller={{ dragRotate: true, touchRotate: true, keyboard: true }}
        layers={layers}
        effects={EFFECTS}
        onClick={onClick}
        getCursor={cursor}
        getTooltip={tooltip}
      >
        <BaseMap
          mapStyle={BASEMAP_STYLE}
          attributionControl={{ compact: false }}
          reuseMaps
        />
      </DeckGL>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <CitySearchBar />
          {selectedId ? <CityInspectionPanel id={selectedId} /> : null}
        </div>
        <ViewportControls
          viewState={viewState}
          onZoom={(delta) => ease({ zoom: viewState.zoom + delta })}
          onResetNorth={() => ease({ bearing: 0, pitch: PITCH_3D })}
          onTogglePitch={() => ease({ pitch: viewState.pitch ? 0 : PITCH_3D })}
        />
      </div>
    </div>
  );
}
