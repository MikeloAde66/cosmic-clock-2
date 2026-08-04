'use client';

import { useEffect } from 'react';

export const useContextMenuShare = () => {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Look for any element or parent that has 'data-shareable'
      const target = (e.target as HTMLElement).closest('[data-shareable]');
      if (!target) return;

      e.preventDefault(); // Stop default browser context menu
      
      const shareData = {
        title: target.getAttribute('data-title') || 'AiOne Cosmic Hub',
        text: target.getAttribute('data-desc') || 'Check out this item on AiOne',
        url: target.getAttribute('data-url') || window.location.href,
      };

      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareData.url);
        alert('Share link copied to clipboard!');
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);
};