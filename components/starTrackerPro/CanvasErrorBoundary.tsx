'use client';

import React from 'react';

// R3F throws inside a mount effect when `new THREE.WebGLRenderer(...)`
// itself fails (context creation refused entirely, not merely lost later)
// — a plain try/catch around <Canvas> can't see that, since it happens
// after render/commit. A class boundary is the one thing React lets catch
// errors from a child's effects, so this is real error-boundary machinery,
// not a stylistic choice.
interface Props {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class CanvasErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Star Tracker PRO: WebGL canvas failed to initialize:', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
