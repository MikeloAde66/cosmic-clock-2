'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AtlasWorld } from '@/lib/astroSim/atlasWorlds';

export interface AtlasMarker {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
}

// Zoomable map of one world from NASA Solar System Treks tiles. Leaflet's
// EPSG:4326 CRS has the same layout as these tiles: 2 x 1 tiles at zoom 0,
// 256 px each, lon -180..180 left to right, lat 90..-90 top to bottom.
export default function AtlasMap({
  world,
  markers,
  focus,
  onSelect,
}: {
  world: AtlasWorld;
  markers: AtlasMarker[];
  focus: { id: string; n: number } | null;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Map<string, L.CircleMarker>>(new Map());
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const bounds = L.latLngBounds([-90, -180], [90, 180]);
    const map = L.map(el, {
      crs: L.CRS.EPSG4326,
      center: [0, 0],
      zoom: 1,
      minZoom: 0,
      maxZoom: world.maxNativeZoom + 2,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      attributionControl: false,
      zoomControl: false,
      zoomSnap: 0.25,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.fitBounds(bounds, { animate: false });
    L.tileLayer(world.tiles, {
      tileSize: 256,
      noWrap: true,
      bounds,
      minZoom: 0,
      maxNativeZoom: world.maxNativeZoom,
      maxZoom: world.maxNativeZoom + 2,
    }).addTo(map);
    L.control
      .attribution({ prefix: false })
      .addAttribution('Imagery: NASA Solar System Treks · ' + world.imageryCredit)
      .addTo(map);
    const refs = markerRefs.current;
    refs.clear();
    for (const m of markers) {
      const c = L.circleMarker([m.latDeg, m.lonDeg], { radius: 5, color: '#fbbf24', weight: 1.5, fillColor: '#fbbf24', fillOpacity: 0.35 })
        .bindTooltip(m.name, { direction: 'top' })
        .on('click', () => selectRef.current(m.id))
        .addTo(map);
      refs.set(m.id, c);
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      refs.clear();
    };
  }, [world, markers]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const m = markers.find((x) => x.id === focus.id);
    if (m) mapRef.current.flyTo([m.latDeg, m.lonDeg], Math.min(world.maxNativeZoom, 5), { duration: 1.2 });
  }, [focus, markers, world]);

  return (
    <div
      ref={host}
      className="w-full h-full !bg-black [&_.leaflet-control-attribution]:!bg-black/75 [&_.leaflet-control-attribution]:!text-slate-300 [&_.leaflet-control-attribution]:!text-[10px] [&_.leaflet-control-attribution_a]:!text-cyan-300 [&_.leaflet-bar_a]:bg-slate-900 [&_.leaflet-bar_a]:text-white [&_.leaflet-bar_a]:border-slate-700"
    />
  );
}
