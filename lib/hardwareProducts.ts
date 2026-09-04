// Builder Kit and Ai One Core (hardware pre-orders that never had real
// inventory) have been pulled from this catalog and their routes deleted —
// see app/products/, GalleryGrid.tsx, and the two now-animated placeholder
// slots (Automations, Merch) that took their place on the grid. HydroNode
// Pro is the only product left here; its real one-time Stripe charge still
// runs via app/actions/hardwareCheckout.ts — inline price_data, no
// persisted Stripe Price object needed. What's still missing is
// fulfillment: no OS image, STL files, or webhook exists to hand anything
// over automatically once a charge succeeds. manualFulfillment marks that
// gap so the detail page can keep being honest about it (real charge
// today, delivery follows by email) instead of implying an instant unlock
// that doesn't exist.
export interface HardwareProduct {
  id: string;
  categoryBadge: string;
  name: string;
  brandedTitle: string;
  priceCents: number;
  // Real hero graphic slot — doesn't exist in public/images/ yet. Renders
  // as a broken image until the real file is saved at that exact path.
  heroImageSrc: string;
  // Optional looping MP4/WebM demo, e.g. '/videos/aione-core-demo.mp4' —
  // when set, replaces heroImageSrc as the rendered media (which still
  // doubles as the video's poster frame) in both the carousel card and
  // detail page hero. No product sets this yet.
  videoSrc?: string;
  heroTagline: string;
  essence: string;
  features: string[];
  // Optional labeled Bill of Materials grid for the detail page — when
  // present, replaces the plain checkmark list built from `features`.
  bom?: { label: string; value: string }[];
  callout: string;
  preOrderCta: string;
  featured?: boolean;
  manualFulfillment?: boolean;
}

export const HARDWARE_PRODUCTS: HardwareProduct[] = [
  {
    id: 'hydronode-pro',
    categoryBadge: 'TURNKEY NODE',
    name: 'HydroNode Pro',
    brandedTitle: 'Ai One HydroNode™ Pro',
    heroImageSrc: '/images/hydronode-pro.png',
    heroTagline: 'AUTONOMY MEETS PRECISION.',
    priceCents: 49900,
    essence:
      'HydroNode Pro is a turn-key virtual telemetry hub and edge software architecture. It delivers local classification models, real-time trigger logic for external relays, and offline dashboard management — accessible directly in your browser or downloadable as a pre-configured local OS image.',
    features: [
      'Virtual Telemetry Hub: Interactive browser-based controls, real-time threshold monitoring, and streaming data logging',
      'Edge OS Disk Image: Pre-configured disk image (.img) for self-build deployments on local hardware',
      'DIY Schematic Architecture: Complete wiring diagrams, relay trigger pinouts, and IP65 enclosure STL files for 3D printing',
      'Data Sovereignty: 100% encrypted SQLite database logging with zero cloud dependencies',
    ],
    callout: '100% Data Sovereignty — zero cloud dependencies, fully offline local mesh dashboard reachable from any smartphone or browser.',
    preOrderCta: 'Get HydroNode Pro →',
    featured: true,
    manualFulfillment: true,
  },
];
