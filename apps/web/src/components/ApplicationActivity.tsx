import { lazy, Suspense, useState } from 'react';
import { Card, Tabs } from '../ui/Primitives.js';
const Messages = lazy(() =>
  import('./EmailIntelligenceView.js').then((module) => ({
    default: module.EmailIntelligenceView,
  })),
);
const Interviews = lazy(() =>
  import('./InterviewWorkspaceView.js').then((module) => ({
    default: module.InterviewWorkspaceView,
  })),
);
export function ApplicationActivity({ applicationId }: { applicationId: string }) {
  const [tab, setTab] = useState('messages');
  return (
    <section aria-label="Application activity">
      <p>
        Messages and interviews below belong to this application. Reviewing an email does not send a
        reply or accept an invitation.
      </p>
      <Tabs
        label="Application activity"
        value={tab}
        items={[
          { id: 'messages', label: 'Messages & review' },
          { id: 'interviews', label: 'Interviews & preparation' },
        ]}
        onChange={setTab}
      />
      <Suspense fallback={<Card role="status">Loading application activity…</Card>}>
        {tab === 'messages' ? (
          <Messages key={applicationId} applicationId={applicationId} />
        ) : (
          <Interviews key={applicationId} applicationId={applicationId} />
        )}
      </Suspense>
    </section>
  );
}
