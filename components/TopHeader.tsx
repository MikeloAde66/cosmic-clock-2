import { useState } from 'react';
import { ChevronLeft, Search, Download, Share2, Trash2, Grid3x3, List, Database } from 'lucide-react';

interface TopHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterType: 'all' | 'image' | 'video';
  onFilterChange: (type: 'all' | 'image' | 'video') => void;
  checkedItems: Set<string>;
  onShowAssets: () => void;
}

export function TopHeader({ 
  searchQuery, 
  onSearchChange, 
  filterType, 
  onFilterChange,
  checkedItems,
  onShowAssets
}: TopHeaderProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleDownload = () => {
    if (checkedItems.size > 0) {
      alert(`Downloading ${checkedItems.size} item(s)`);
    }
  };

  const handleShare = () => {
    if (checkedItems.size > 0) {
      alert(`Sharing ${checkedItems.size} item(s)`);
    } else {
      alert('Share collection link copied to clipboard!');
    }
  };

  const handleDelete = () => {
    if (checkedItems.size > 0) {
      if (confirm(`Delete ${checkedItems.size} selected item(s)?`)) {
        alert('Items deleted');
      }
    }
  };

  return (
    <div className="bg-black border-b border-gray-900">
      <div className="px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.history.back()}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Home</span>
            </button>
            <div className="h-6 w-px bg-gray-800 hidden sm:block"></div>
            <div>
              <h1 className="text-xl lg:text-2xl font-light tracking-wider">
                Q-Rator <span className="text-yellow-600">1</span>
              </h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest hidden lg:block">
                Perceptual Lens for Creatives
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="relative flex-1 lg:flex-initial lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search masters..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-gray-900 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-800 focus:border-yellow-600 focus:outline-none text-sm"
              />
            </div>

            <div className="hidden sm:flex items-center space-x-1 bg-gray-900 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onShowAssets}
              className="px-3 lg:px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg text-white transition-colors text-sm border border-gray-800"
            >
              <span className="hidden sm:inline">Assets</span>
              <Database className="w-4 h-4 sm:hidden" />
            </button>

            <button
              onClick={handleShare}
              className="px-3 lg:px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 rounded-lg text-white transition-colors text-sm flex items-center space-x-2"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {checkedItems.size > 0 && (
              <>
                <button
                  onClick={handleDownload}
                  className="p-2 bg-gray-900 hover:bg-gray-800 rounded-lg text-white transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-lg text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-4">
          <button
            onClick={() => onFilterChange('all')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              filterType === 'all' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onFilterChange('image')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              filterType === 'image' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            Images
          </button>
          <button
            onClick={() => onFilterChange('video')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              filterType === 'video' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            Videos
          </button>
        </div>
      </div>
    </div>
  );
}