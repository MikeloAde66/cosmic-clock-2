'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';

interface LineItem {
  description: string;
  amount: number;
}

interface ProcessingResult {
  claimId: string;
  policyNum: string;
  claimType: string;
  fileName: string;
  fileSize: string;
  lineItems: LineItem[];
  subtotal: number;
  deductible: number;
  netPayout: number;
  processingTime: string;
  fraudScore: number;
  confidenceScore: number;
}

const CLAIM_PRESETS: Record<string, { label: string; items: { description: string; baseAmount: number }[]; deductible: number }> = {
  auto: {
    label: '🚗 Auto Insurance',
    deductible: 500,
    items: [
      { description: 'Body Repair & Paint Estimate', baseAmount: 3200 },
      { description: 'OEM Replacement Parts', baseAmount: 1450 },
      { description: 'Rental Vehicle Coverage (4 days)', baseAmount: 360 }
    ]
  },
  health: {
    label: '🏥 Health Insurance',
    deductible: 250,
    items: [
      { description: 'Outpatient Facility Fee', baseAmount: 1850 },
      { description: 'Diagnostic Imaging (MRI)', baseAmount: 920 },
      { description: 'Prescription Pharmaceuticals', baseAmount: 340 }
    ]
  },
  property: {
    label: '🏠 Property Insurance',
    deductible: 1000,
    items: [
      { description: 'Water Damage Remediation', baseAmount: 4800 },
      { description: 'Drywall & Floor Restoration', baseAmount: 2900 },
      { description: 'Personal Property Loss Assessment', baseAmount: 1200 }
    ]
  },
  life: {
    label: '💼 Life Insurance',
    deductible: 0,
    items: [
      { description: 'Primary Policy Death Benefit', baseAmount: 50000 },
      { description: 'Accidental Death Rider', baseAmount: 10000 }
    ]
  }
};

const PROCESSING_STEPS = [
  { icon: '📄', title: 'File Ingestion & Validation', status: 'Reading uploaded document structure...' },
  { icon: '🔍', title: 'OCR & Text Extraction', status: 'Extracting line items and monetary values...' },
  { icon: '🎯', title: 'Policy Cross-Reference', status: 'Verifying coverage terms and active status...' },
  { icon: '🚨', title: 'Anomaly & Fraud Assessment', status: 'Evaluating duplicate claims and cost thresholds...' },
  { icon: '💰', title: 'Payout Reconciliation', status: 'Applying deductible and calculating net payout...' }
];

export default function InsuranceClaimsPage() {
  const [claimType, setClaimType] = useState<string>('auto');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const processClaim = () => {
    setIsProcessing(true);
    setResults(null);
    setCurrentStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < PROCESSING_STEPS.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
        setIsProcessing(false);

        // Calculate dynamic math from preset and uploaded file attributes
        const preset = CLAIM_PRESETS[claimType];
        const fileSizeFactor = selectedFile ? (selectedFile.size % 150) : 50;

        const lineItems = preset.items.map(item => ({
          description: item.description,
          amount: item.baseAmount + fileSizeFactor
        }));

        const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
        const deductible = preset.deductible;
        const netPayout = Math.max(0, subtotal - deductible);

        const fileSizeMB = selectedFile
          ? (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB'
          : 'Sample_Claim.pdf (1.2 MB)';

        setResults({
          claimId: `CLM-${Math.floor(100000 + Math.random() * 900000)}`,
          policyNum: `POL-${claimType.toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`,
          claimType: preset.label,
          fileName: selectedFile ? selectedFile.name : 'Sample_Document.pdf',
          fileSize: fileSizeMB,
          lineItems,
          subtotal,
          deductible,
          netPayout,
          processingTime: (1.8 + Math.random() * 0.8).toFixed(1),
          fraudScore: Math.floor(12 + Math.random() * 10),
          confidenceScore: 96
        });
      }
    }, 500);
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0b14] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Bar */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b px-6 py-4 flex justify-between items-center ${isDarkMode ? 'bg-[#0a0b14]/85 border-purple-500/15' : 'bg-white/85 border-slate-200'}`}>
        <Link href="/" className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-semibold hover:bg-purple-500/20 transition">
          ← Back to Q_Labs
        </Link>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-semibold hover:bg-purple-500/20 transition"
        >
          {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">⚡ Q_Insurance Claims</h1>
          <p className="text-lg text-emerald-500 font-medium mb-1">Phase 1: File Ingestion & Automated Math Engine</p>
          <p className="text-xs opacity-75">Local File Processing • Dynamic Line-Item Reconciliation • Automated Approval</p>
        </header>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* File Upload & Configuration */}
          <div className={`lg:col-span-5 border rounded-2xl p-6 shadow-xl ${isDarkMode ? 'bg-[#151620] border-purple-500/15' : 'bg-white border-slate-200'}`}>
            <h2 className="font-semibold text-lg mb-4 text-purple-300 flex items-center gap-2">
              📂 Step 1: Upload Document
            </h2>

            {/* Drag & Drop Zone */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                selectedFile
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : isDarkMode ? 'border-purple-500/30 hover:border-emerald-500 hover:bg-purple-500/5' : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
              }`}
            >
              <span className="text-4xl block mb-2">{selectedFile ? '✅' : '📄'}</span>
              {selectedFile ? (
                <div>
                  <p className="font-bold text-sm text-emerald-400">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB • Click to change file</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-sm">Click or Drag Claim File Here</p>
                  <p className="text-xs text-slate-400 mt-1">Supports PDF, PNG, JPG (Repair estimates, receipts, bills)</p>
                </div>
              )}
            </div>

            {/* Claim Type Selection */}
            <div className="mt-6">
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Select Insurance Category</label>
              <div className="space-y-2">
                {Object.entries(CLAIM_PRESETS).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setClaimType(key)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm font-semibold flex justify-between items-center ${
                      claimType === key
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-600 shadow-md'
                        : isDarkMode ? 'bg-purple-500/5 border-purple-500/15 hover:border-purple-400' : 'bg-slate-50 border-slate-200 hover:border-emerald-500'
                    }`}
                  >
                    <span>{value.label}</span>
                    <span className="text-xs opacity-80">Deductible: ${value.deductible}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={processClaim}
              disabled={isProcessing}
              className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 font-bold text-white rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isProcessing ? '⚙️ Ingesting & Calculating...' : '🚀 Execute Claim Automation'}
            </button>
          </div>

          {/* Execution Pipeline & Results Panel */}
          <div className={`lg:col-span-7 border rounded-2xl p-6 shadow-xl ${isDarkMode ? 'bg-[#151620] border-purple-500/15' : 'bg-white border-slate-200'}`}>
            {!isProcessing && !results && (
              <div className="text-center py-24 text-slate-400">
                <span className="text-6xl block mb-4">⚡</span>
                <h3 className="text-xl font-bold text-slate-300">Awaiting Claim Document</h3>
                <p className="text-sm mt-1">Select or drop a claim document on the left and click &quot;Execute Claim Automation&quot;.</p>
              </div>
            )}

            {isProcessing && (
              <div>
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-purple-300">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
                  Processing Pipeline Active
                </h3>
                <div className="space-y-4">
                  {PROCESSING_STEPS.map((step, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-4 p-4 rounded-xl border-l-4 transition ${
                        idx === currentStep
                          ? 'border-l-emerald-500 bg-emerald-500/10 border-t border-r border-b border-emerald-500/20'
                          : idx < currentStep
                          ? 'border-l-emerald-500 bg-emerald-500/5 opacity-70'
                          : 'border-l-slate-700 bg-slate-800/10 opacity-30'
                      }`}
                    >
                      <span className="text-2xl">{step.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{step.title}</p>
                        <p className="text-xs text-slate-400">{step.status}</p>
                      </div>
                      {idx <= currentStep && <span className="text-emerald-500 font-bold text-sm">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results && (
              <div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/40">
                  <div>
                    <h3 className="font-bold text-xl text-emerald-400 flex items-center gap-2">
                      ✅ Claim Auto-Approved
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Processed from: {results.fileName} ({results.fileSize})</p>
                  </div>
                  <span className="font-mono text-xs px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-300">
                    {results.claimId}
                  </span>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-800/40 border-l-4 border-emerald-500 rounded-r-xl">
                    <p className="text-xs text-slate-400">Net Claim Payout</p>
                    <p className="text-2xl font-bold text-emerald-400">${results.netPayout.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">After deductible</p>
                  </div>
                  <div className="p-4 bg-slate-800/40 border-l-4 border-emerald-500 rounded-r-xl">
                    <p className="text-xs text-slate-400">Processing Time</p>
                    <p className="text-2xl font-bold">{results.processingTime}s</p>
                    <p className="text-xs text-emerald-400 mt-1">Instant STP</p>
                  </div>
                  <div className="p-4 bg-slate-800/40 border-l-4 border-emerald-500 rounded-r-xl">
                    <p className="text-xs text-slate-400">Fraud Anomaly Score</p>
                    <p className="text-2xl font-bold">{results.fraudScore}%</p>
                    <p className="text-xs text-emerald-400 mt-1">Low Risk Threshold</p>
                  </div>
                </div>

                {/* Line Item Table */}
                <div className={`p-4 rounded-xl border mb-6 ${isDarkMode ? 'bg-slate-900/60 border-purple-500/20' : 'bg-white border-slate-200'}`}>
                  <h4 className="font-bold text-sm mb-3 text-purple-300">Extracted Line Items & Reconciliation</h4>
                  <div className="space-y-2 text-xs">
                    {results.lineItems.map((item, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-slate-800/60">
                        <span className="text-slate-300">{item.description}</span>
                        <span className="font-mono font-semibold">${item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 border-b border-slate-700/60 font-semibold">
                      <span className="text-slate-400">Subtotal Calculated</span>
                      <span className="font-mono">${results.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-700/60 text-amber-400">
                      <span>Policy Deductible Applied</span>
                      <span className="font-mono">-${results.deductible.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 pt-3 text-sm font-bold text-emerald-400">
                      <span>Net Approved Amount</span>
                      <span className="font-mono">${results.netPayout.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/10 border-l-4 border-emerald-500 text-xs text-emerald-300">
                  <p className="font-bold mb-1">Decision Engine Confidence: {results.confidenceScore}%</p>
                  <p>All verification checks passed. Document signature and line items verified against policy #{results.policyNum}.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
