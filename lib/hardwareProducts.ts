// Real one-time Stripe charge now runs for all three (see
// app/actions/hardwareCheckout.ts — inline price_data, no persisted Stripe
// Price object needed). What's still missing is fulfillment: no OS image,
// STL files, or webhook exists to hand anything over automatically once a
// charge succeeds. manualFulfillment marks that gap so the detail page can
// keep being honest about it (real charge today, delivery follows by email)
// instead of implying an instant unlock that doesn't exist.
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
    id: 'builder-kit',
    categoryBadge: 'DIGITAL OS & BLUEPRINTS',
    name: 'Builder Kit',
    brandedTitle: 'Ai One HydroNode™ Builder Kit',
    heroImageSrc: '/images/builder-kit.png',
    heroTagline: 'BUILD INTELLIGENCE. OWN YOUR DATA.',
    priceCents: 29900,
    essence:
      'The HydroNode™ Builder Kit provides complete digital access to our edge-AI water intelligence architecture. Includes the downloadable, cloud-free Edge OS disk image, interactive telemetry web dashboard, step-by-step DIY component wiring guides, and 3D-printable IP65 enclosure STL files to deploy autonomous local water monitoring on your own hardware.',
    features: [
      'Edge OS Disk Image: Pre-configured 32GB MicroSD image (.img) featuring local offline OS & telemetry dashboard',
      'Interactive Telemetry Engine: In-browser threshold analysis, encrypted SQLite logging, and Kali AI diagnostic tools',
      'DIY Hardware Architecture: Turnkey wiring schematics for TDS probes, optical turbidity sensors, ADS1115 ADC boards, and 12V relays',
      '3D STL Enclosure Models: Downloadable print-ready files for custom weatherproof mounting cases',
    ],
    callout: '100% Data Sovereignty — zero cloud dependencies, native 12V solar-ready power draw under 5 Watts.',
    preOrderCta: 'Pre-Order Builder Kit →',
    manualFulfillment: true,
  },
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
  {
    id: 'aione-core',
    categoryBadge: 'AGENTIC ENGINE',
    name: 'Ai One Core',
    brandedTitle: 'Ai One Core™',
    heroImageSrc: '/images/aione-core.png',
    heroTagline: 'The Heart of Your Offline Network',
    priceCents: 59900,
    essence:
      'Ai One Core is the central autonomous intelligence engine of your platform. Operating as a pure-software research and execution hub, it powers self-correcting agentic workflows, multi-step tool dispatches, local telemetry aggregation, and high-performance quantum circuit simulations directly inside your workspace.',
    features: [
      'High-Tier Single-Board Compute (Raspberry Pi 5 8GB / Rock 5B) in Industrial Aluminum Passive Heatsink Chassis',
      '1TB NVMe M.2 SSD (PCIe HAT) Running Encrypted SQLite Vault & Offline Matrix Server',
      'Multichannel SX1302 LoRa Gateway Concentrator with Onboard Wi-Fi 6 AP & Dual Gigabit Ethernet',
      '12V–24V DC Wide-Input Step-Down Converter with Seamless UPS Battery Failover',
      'Local WebXR VR Sandbox for Offline Spatial Development & Documentation',
    ],
    bom: [
      { label: 'Agentic Execution Engine', value: 'Autonomous multi-step planning, tool dispatching, and self-healing error correction loops.' },
      { label: 'Encrypted Vault & Logging', value: 'Native offline SQLite database structure for complete data sovereignty and session state retention.' },
      { label: 'Telemetry Aggregator', value: 'Centralized hub logic for tracking field-deployed HydroNode data streams and localized metrics.' },
      { label: 'Spatial & Simulation Hub', value: 'Integrated browser-based environment for running real-time quantum and physics simulations.' },
    ],
    callout: '100% Data Sovereignty — offline Matrix server and local WebXR sandbox, no cloud round-trip required.',
    preOrderCta: 'Pre-Order Ai One Core →',
    manualFulfillment: true,
  },
];
