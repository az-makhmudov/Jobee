import React from 'react';
import type { CareerFitCategory } from '@job-agent/shared';

interface CareerFitBadgeProps {
  category: CareerFitCategory | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

interface BadgeConfig {
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  description: string;
}

const BADGE_CONFIGS: Record<CareerFitCategory, BadgeConfig> = {
  STRONG_MATCH: {
    label: 'Strong Match',
    icon: '★',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    textColor: '#34d399',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    description: 'High alignment with verified qualifications, seniority, and preferences.',
  },
  GOOD_MATCH: {
    label: 'Good Match',
    icon: '✓',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    textColor: '#60a5fa',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    description: 'Solid profile alignment with minor differences or unstated perks.',
  },
  TRANSFERABLE_SKILLS_MATCH: {
    label: 'Transferable Skills',
    icon: '⇄',
    bgColor: 'rgba(139, 92, 246, 0.18)',
    textColor: '#a78bfa',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    description: 'Direct skills differ, but verified capabilities translate strongly into this role.',
  },
  GROWTH_OPPORTUNITY: {
    label: 'Growth Opportunity',
    icon: '↗',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    textColor: '#fbbf24',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    description: 'Stretch role offering career advancement; some requirements will need skill growth.',
  },
  NOT_CURRENTLY_ELIGIBLE: {
    label: 'Not Currently Eligible',
    icon: '✕',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    textColor: '#f87171',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    description: 'Excluded by hard policy: work authorization, location, or salary blocker.',
  },
  INSUFFICIENT_INFORMATION: {
    label: 'Needs Clarification',
    icon: '?',
    bgColor: 'rgba(148, 163, 184, 0.15)',
    textColor: '#cbd5e1',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    description: 'Key candidate preferences or job posting details are missing.',
  },
};

export const CareerFitBadge: React.FC<CareerFitBadgeProps> = ({
  category,
  size = 'md',
  showDescription = false,
}) => {
  if (!category || !BADGE_CONFIGS[category]) {
    return null;
  }

  const config = BADGE_CONFIGS[category];

  const padding = size === 'sm' ? '0.15rem 0.5rem' : size === 'lg' ? '0.4rem 0.9rem' : '0.25rem 0.7rem';
  const fontSize = size === 'sm' ? '0.72rem' : size === 'lg' ? '0.9rem' : '0.8rem';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          backgroundColor: config.bgColor,
          color: config.textColor,
          border: `1px solid ${config.borderColor}`,
          borderRadius: '9999px',
          padding,
          fontSize,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
        title={config.description}
      >
        <span style={{ fontSize: '1.05em' }}>{config.icon}</span>
        <span>{config.label}</span>
      </span>
      {showDescription && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
          {config.description}
        </span>
      )}
    </div>
  );
};
