// Visual placeholders only — neither product has a real Stripe Price yet
// (unlike STANDALONE_PRODUCTS/PRICING_TIERS, which are always real,
// already-provisioned Stripe ids). Give each a real entry there once
// pricing/checkout is real — until then the detail page's CTA does
// nothing on click (no handler wired) rather than pretending to charge
// anyone, even though it's styled as a bold, fully "live" button.
export interface HardwareProduct {
  id: string;
  categoryBadge: string;
  name: string;
  brandedTitle: string;
  priceCents: number;
  // Real hero graphic slot — doesn't exist in public/images/ yet. Renders
  // as a broken image until the real file is saved at that exact path.
  heroImageSrc: string;
  heroTagline: string;
  essence: string;
  features: string[];
  callout: string;
  preOrderCta: string;
  featured?: boolean;
  comingSoon?: boolean;
}

export const HARDWARE_PRODUCTS: HardwareProduct[] = [
  {
    id: 'builder-kit',
    categoryBadge: 'HARDWARE KIT',
    name: 'Builder Kit',
    brandedTitle: 'Ai One HydroNode™ Builder Kit',
    heroImageSrc: '/images/builder-kit.png',
    heroTagline: 'BUILD INTELLIGENCE. OWN YOUR DATA.',
    priceCents: 29900,
    essence:
      'The Builder Kit is an autonomous, off-grid water intelligence terminal in component form — pre-soldered, pre-flashed core hardware built for hands-on integration. It runs quantized local classification models and encrypted SQLite logging directly on embedded hardware, reading Total Dissolved Solids and turbidity through onboard analog sensors with zero cloud dependency.',
    features: [
      'Pre-flashed 32GB Industrial MicroSD (Pre-loaded Offline OS & Dashboard)',
      'Pre-soldered Analog TDS Probe & Gravity Optical Turbidity Assembly',
      'ADS1115 16-Bit 4-Channel ADC Board & 4-Channel 12V Relay Module',
      'Native 12V DC Step-Down Buck Converter (< 5W Low-Draw Power)',
      'Comprehensive Assembly Guide & Custom Wiring Harness',
    ],
    callout: '100% Data Sovereignty — zero cloud dependencies, native 12V solar-ready power draw under 5 Watts.',
    preOrderCta: 'Pre-Order Builder Kit →',
    comingSoon: true,
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
      'HydroNode Pro is a fully assembled, autonomous water intelligence hub housed in an IP65 weatherproof enclosure. Running local classification models on a Raspberry Pi 4, it dynamically triggers pumps, UV-C sterilization, and diverter solenoids in real time, serving live telemetry over its own offline local Wi-Fi access point — no internet connection required.',
    features: [
      'Fully Assembled IP65 Weatherproof Junction Box with External Probe Glands',
      'Raspberry Pi 4 Model B Central Processor running Local Neural Algorithms',
      'Automated Multi-Stage Relay Control for Pumps, Solenoids, and UV-C LEDs',
      '100% Encrypted SQLite Database for Local Data Sovereignty',
      'Local Mesh Dashboard (Connect from any smartphone or browser offline)',
    ],
    callout: '100% Data Sovereignty — zero cloud dependencies, fully offline local mesh dashboard reachable from any smartphone or browser.',
    preOrderCta: 'Get HydroNode Pro →',
    featured: true,
    comingSoon: true,
  },
  {
    id: 'aione-core',
    categoryBadge: 'CENTRAL HUB',
    name: 'Ai One Core',
    brandedTitle: 'Ai One Core™',
    heroImageSrc: '/images/aione-core.png',
    heroTagline: 'Local Off-Grid Hub & VR Sandbox',
    priceCents: 59900,
    essence:
      'Ai One Core is the central micro-server for the entire node network — a low-draw offline communications hub and local VR spatial development engine. It aggregates real-time telemetry from field-deployed HydroNode units over LoRa, hosts an offline Matrix server and knowledge vault, and tracks solar microgrid power generation and battery state-of-charge, all without a cloud round-trip.',
    features: [
      'High-Tier Single-Board Compute (Raspberry Pi 5 8GB / Rock 5B) in Industrial Aluminum Passive Heatsink Chassis',
      '1TB NVMe M.2 SSD (PCIe HAT) Running Encrypted SQLite Vault & Offline Matrix Server',
      'Multichannel SX1302 LoRa Gateway Concentrator with Onboard Wi-Fi 6 AP & Dual Gigabit Ethernet',
      '12V–24V DC Wide-Input Step-Down Converter with Seamless UPS Battery Failover',
      'Local WebXR VR Sandbox for Offline Spatial Development & Documentation',
    ],
    callout: '100% Data Sovereignty — offline Matrix server and local WebXR sandbox, no cloud round-trip required.',
    preOrderCta: 'Pre-Order Ai One Core →',
    comingSoon: true,
  },
];
