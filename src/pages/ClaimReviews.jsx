import React from 'react';
import ReviewClaimQueue from '../components/ReviewClaimQueue';

// Standalone page version (also embedded as a tab in the AM and consultant bonus dashboards).
export default function ClaimReviews() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Claim Reviews</h1>
      </div>
      <ReviewClaimQueue />
    </div>
  );
}
