import type { RecommendationStatusDto } from '@job-agent/shared';
import { Card } from '../ui/Primitives.js';

/** One accessible preparation state before Explore publishes its analyzed results. */
export function ExploreLoadingState({
  discovering,
  recommendations,
  library = false,
}: {
  discovering: boolean;
  library?: boolean;
  recommendations: RecommendationStatusDto | null;
}) {
  const analyzing =
    recommendations &&
    (recommendations.pending > 0 || ['QUEUED', 'ANALYZING'].includes(recommendations.state));
  return (
    <Card className="explore-loading" role="status" aria-live="polite" aria-atomic="true">
      <span className="explore-loading-spinner" aria-hidden="true" />
      <h2>
        {library
          ? 'Loading saved jobs'
          : discovering
            ? 'Finding jobs for you'
            : analyzing
              ? 'Analyzing jobs for your profile'
              : 'Loading your jobs'}
      </h2>
      <p>
        {library
          ? 'Your saved job library will be ready shortly.'
          : 'We’ll show your analyzed recommendations when they’re ready.'}
      </p>
      {analyzing && (
        <p>
          {recommendations.evaluated} analyzed · {recommendations.pending} remaining
        </p>
      )}
    </Card>
  );
}
