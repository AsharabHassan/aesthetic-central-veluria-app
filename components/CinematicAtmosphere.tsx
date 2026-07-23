import type { CSSProperties } from "react";
import {
  CINEMATIC_ASSET_MAP,
  type CinematicAssetId,
  type CinematicScene,
} from "@/lib/cinematicAssets";

type LayerPreset = {
  id: CinematicAssetId;
  className: string;
  style?: CSSProperties;
};

const SCENE_LAYERS: Record<CinematicScene, LayerPreset[]> = {
  welcome: [
    { id: "light-leak-drift-vertical", className: "cinematic-cover cinematic-light-welcome" },
    { id: "halo-orbit-primary", className: "cinematic-halo cinematic-halo-welcome" },
    { id: "glass-caustic-wave", className: "cinematic-cover cinematic-caustic-welcome" },
    { id: "serum-ribbon-arc", className: "cinematic-ribbon cinematic-ribbon-welcome" },
    { id: "serum-droplets-fine", className: "cinematic-specks cinematic-specks-welcome" },
    { id: "edge-vignette-depth", className: "cinematic-cover cinematic-depth" },
  ],
  processing: [
    { id: "halo-orbit-close", className: "cinematic-halo cinematic-halo-processing" },
    { id: "scan-beam-horizontal", className: "cinematic-cover cinematic-scan-processing" },
    { id: "scan-beam-vertical", className: "cinematic-cover cinematic-scan-vertical" },
    { id: "face-zone-hairline", className: "cinematic-hairline cinematic-hairline-processing" },
    { id: "serum-droplets-fine", className: "cinematic-specks cinematic-specks-processing" },
    { id: "edge-vignette-depth", className: "cinematic-cover cinematic-depth" },
  ],
  report: [
    { id: "light-leak-corner-warm", className: "cinematic-cover cinematic-light-report" },
    { id: "halo-orbit-offset", className: "cinematic-halo cinematic-halo-report" },
    { id: "glass-caustic-wave", className: "cinematic-cover cinematic-caustic-report" },
    { id: "leader-lines-left", className: "cinematic-lines cinematic-lines-left" },
    { id: "leader-lines-right", className: "cinematic-lines cinematic-lines-right" },
    { id: "edge-vignette-depth", className: "cinematic-cover cinematic-depth" },
  ],
};

export default function CinematicAtmosphere({
  scene,
  className = "",
}: {
  scene: CinematicScene;
  className?: string;
}) {
  return (
    <div className={`cinematic-atmosphere cinematic-${scene} ${className}`} aria-hidden="true">
      {SCENE_LAYERS[scene].map((layer, index) => {
        const asset = CINEMATIC_ASSET_MAP[layer.id];
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${scene}-${asset.id}`}
            src={asset.src}
            alt=""
            draggable={false}
            loading={index < 2 ? "eager" : "lazy"}
            decoding="async"
            className={`cinematic-layer ${layer.className}`}
            style={{
              mixBlendMode: asset.blendMode as CSSProperties["mixBlendMode"],
              ...layer.style,
            }}
          />
        );
      })}
    </div>
  );
}
