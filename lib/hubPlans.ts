// Ai One hub plans shown on the pricing screen (components/PricingPlans.tsx).
//
// Checkout is Stripe Payment Links: one hosted link per plan per billing
// interval, each set up in Stripe with a 14-day free trial. Paste a link's
// https://buy.stripe.com/... URL into `links` below and that button goes
// live; while a link is empty the button shows "Coming soon" instead of a
// dead link. Yearly prices are 10x monthly (two months free).

import { AIONE_PRO_SUBSCRIPTION_LINK } from './paymentLinks';

export type BillingInterval = 'monthly' | 'yearly';

export interface HubPlan {
  id: 'free' | 'starter' | 'pro' | 'advanced';
  name: string;
  tagline: string;
  monthly: number; // dollars
  yearly: number; // dollars
  features: string[];
  featured?: boolean;
  links: Record<BillingInterval, string>;
}

export const TRIAL_DAYS = 14;

export const HUB_PLANS: HubPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Look around the hub.',
    monthly: 0,
    yearly: 0,
    features: ['Hub dashboard', 'Live weather', 'Flight Academy: Flight Evaluation', 'Limited access to apps'],
    links: { monthly: '', yearly: '' },
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'The whole hub, every app.',
    monthly: 12,
    yearly: 120,
    features: [
      'Radio Central and Studio One',
      'Star Tracker PRO',
      'Drone Simulator with live travel guide',
      'Flight Academy: all 16 lessons, including the advanced track',
      'Ai One and Kali AI',
      'Automation',
    ],
    links: { monthly: AIONE_PRO_SUBSCRIPTION_LINK, yearly: '' },
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Connect your own gear.',
    monthly: 24,
    yearly: 240,
    featured: true,
    features: [
      'Everything in Starter',
      'Telescope control from Star Tracker PRO',
      'Fly the simulator with a real RC transmitter or gamepad',
      'Live drone telemetry in the Spectre-AI ground station',
    ],
    links: { monthly: '', yearly: '' },
  },
  {
    id: 'advanced',
    name: 'Advanced',
    tagline: 'Full ground-station control.',
    monthly: 36,
    yearly: 360,
    features: [
      'Everything in Pro',
      'Command a real drone: arm, modes, RTL and land',
      'Upload waypoint missions to the aircraft',
      'Network telescopes over ASCOM Alpaca',
      'Priority support',
    ],
    links: { monthly: '', yearly: '' },
  },
];

// What plugs in, by device type. Pro and Advanced unlock these.
export const CONNECTIVITY = [
  {
    title: 'Telescopes',
    plan: 'Pro',
    points: [
      'USB / serial mounts speaking LX200 or Celestron NexStar',
      'Bluetooth LE serial adapters',
      'ASCOM Alpaca over your local network (Advanced)',
    ],
    note: 'USB and Bluetooth need Chrome or Edge on desktop.',
  },
  {
    title: 'Drones',
    plan: 'Pro',
    points: [
      'MAVLink over USB / serial: flight controllers and SiK telemetry radios (433 / 915 MHz)',
      'MAVLink over WebSocket bridges on Wi-Fi',
      'Mission upload and flight commands (Advanced)',
    ],
    note: 'ArduPilot-style autopilots. Always follow local flying rules.',
  },
  {
    title: 'Radio & controllers',
    plan: 'Pro',
    points: [
      '2.4 GHz RC transmitters (ExpressLRS and others) in USB joystick mode',
      'Standard USB and Bluetooth gamepads',
      'Sticks map straight onto the simulator’s pilot deck',
    ],
    note: 'Most EdgeTX radios offer USB joystick mode when plugged in.',
  },
];
