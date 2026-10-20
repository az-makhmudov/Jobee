import { Icon } from '../ui/Primitives.js';
import type { IconName } from '../ui/icons.js';
import React from 'react';
import type { CareerFitCategory } from '@job-agent/shared';

interface CareerFitBadgeProps {
  category: CareerFitCategory | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

interface BadgeConfig {
  label: string;
  icon: IconName;
  bgColor: string;
  textColor: string;
  borderColor: string;
  description: string;
}

const BADGE_CONFIGS: Record<CareerFitCategory, BadgeConfig> = {
  STRONG_MATCH: {
    label: 'Strong Match',
    icon: 'star',
    bgColor: 'var(--status-success-container)',
    textColor: 'var(--status-success)',
    borderColor: 'var(--status-success-border)',
    description: 'High alignment with verified qualifications, seniority, and preferences.',
  },
  GOOD_MATCH: {
    label: 'Good Match',
    icon: 'check',
    bgColor: 'var(--status-success-container)',
    textColor: 'var(--status-success)',
    borderColor: 'var(--status-success-border)',
    description: 'Solid profile alignment with minor differences or unstated perks.',
  },
  TRANSFERABLE_SKILLS_MATCH: {
    label: 'Transferable Skills',
    icon: 'sync',
    bgColor: 'var(--m3-secondary-container)',
    textColor: 'var(--m3-on-surface)',
    borderColor: 'var(--m3-outline-variant)',
    description:
      'Direct skills differ, but verified capabilities translate strongly into this role.',
  },
  GROWTH_OPPORTUNITY: {
    label: 'Growth Opportunity',
    icon: 'forward',
    bgColor: 'var(--status-warning-container)',
    textColor: 'var(--status-warning)',
    borderColor: 'var(--status-warning-border)',
    description:
      'Stretch role offering career advancement; some requirements will need skill growth.',
  },
  NOT_CURRENTLY_ELIGIBLE: {
    label: 'Not Currently Eligible',
    icon: 'cancel',
    bgColor: 'var(--status-danger-container)',
    textColor: 'var(--status-danger)',
    borderColor: 'var(--status-danger-border)',
    description: 'Excluded by hard policy: work authorization, location, or salary blocker.',
  },
  LOW_RELEVANCE: {
    label: 'Lower relevance',
    icon: 'info',
    bgColor: 'var(--m3-secondary-container)',
    textColor: 'var(--m3-on-surface-variant)',
    borderColor: 'var(--m3-outline-variant)',
    description:
      'Professional fit is below the configured threshold; this is separate from legal or policy eligibility.',
  },
  INSUFFICIENT_INFORMATION: {
    label: 'Needs more info',
    icon: 'info',
    bgColor: 'var(--m3-secondary-container)',
    textColor: 'var(--m3-on-surface-variant)',
    borderColor: 'var(--m3-outline-variant)',
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

  const padding =
    size === 'sm' ? '0.15rem 0.5rem' : size === 'lg' ? '0.4rem 0.9rem' : '0.25rem 0.7rem';
  const fontSize = size === 'lg' ? '14px' : '12px';

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
          whiteSpace: 'normal',
          lineHeight: 1.2,
        }}
        title={config.description}
      >
        <Icon name={config.icon} size={16} />
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
