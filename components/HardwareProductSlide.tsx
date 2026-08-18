'use client';

import React from 'react';
import ProductHeroCard from './ProductHeroCard';
import type { HardwareProduct } from '@/lib/hardwareProducts';

export default function HardwareProductSlide({ product }: { product: HardwareProduct }) {
  return (
    <ProductHeroCard
      heroImageSrc={product.heroImageSrc}
      heroTagline={product.heroTagline}
      ctaLabel="Explore Node Specs →"
      ctaHref={`/products/${product.id}`}
    />
  );
}
